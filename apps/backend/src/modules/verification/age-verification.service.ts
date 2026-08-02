import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgeCheckMethod, IdentityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { AgeAssuranceProvider, AgeResult } from './providers/age-assurance.provider';

@Injectable()
export class AgeVerificationService {
  private readonly logger = new Logger(AgeVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AgeAssuranceProvider,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
  ) {}

  private get threshold(): number {
    return this.config.get<number>('guardian.minorAgeThreshold', 18);
  }

  async getStatus(userId: string) {
    const [user, latest] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { ageVerified: true, ageAssurance: true, ageVerifiedAt: true },
      }),
      this.prisma.ageVerification.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    return {
      ageVerified: user.ageVerified,
      method: user.ageAssurance,
      verifiedAt: user.ageVerifiedAt,
      current: latest
        ? { id: latest.id, status: latest.status, method: latest.method, isAdult: latest.isAdult }
        : null,
    };
  }

  async start(userId: string, method: AgeCheckMethod) {
    const selfReportedDob = await this.selfReportedDob(userId);

    const started = await this.provider.start({
      userId,
      method,
      selfReportedDob,
      minorAgeThreshold: this.threshold,
    });

    const expiresAt = new Date(Date.now() + this.config.get<number>('verification.ageReverifyDays', 365) * 864e5);
    const record = await this.prisma.ageVerification.create({
      data: {
        userId,
        method,
        provider: this.provider.name,
        providerSession: started.sessionId,
        status: started.result.status,
        expiresAt,
      },
    });

    // Stub / synchronous providers resolve immediately; real vendors stay PENDING
    // until their webhook lands.
    if (started.result.status !== IdentityStatus.PENDING) {
      await this.finalize(record.id, userId, started.result);
    }

    return {
      sessionId: started.sessionId,
      clientToken: started.clientToken,
      redirectUrl: started.redirectUrl,
      status: started.result.status,
    };
  }

  async handleWebhook(headers: Record<string, string>, raw: Buffer) {
    const { sessionId, result } = this.provider.parseWebhook(headers, raw);
    const record = await this.prisma.ageVerification.findUnique({ where: { providerSession: sessionId } });
    if (!record) {
      this.logger.warn(`Age webhook for unknown session ${sessionId}`);
      return { ok: true };
    }
    if (record.status === IdentityStatus.APPROVED || record.status === IdentityStatus.DECLINED) {
      return { ok: true }; // idempotent — already finalized
    }
    await this.finalize(record.id, record.userId, result);
    return { ok: true };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async finalize(recordId: string, userId: string, result: AgeResult) {
    await this.prisma.ageVerification.update({
      where: { id: recordId },
      data: {
        status: result.status,
        isAdult: result.isAdult,
        estimatedAge: result.estimatedAge,
        confirmedDob: result.confirmedDob ?? undefined,
        docType: result.docType,
        docCountry: result.docCountry,
        failureReason: result.reason,
      },
    });

    if (result.status === IdentityStatus.APPROVED) {
      const record = await this.prisma.ageVerification.findUnique({ where: { id: recordId } });
      await this.prisma.user.update({
        where: { id: userId },
        data: { ageVerified: true, ageAssurance: record!.method, ageVerifiedAt: new Date() },
      });
      await this.reconcileMinorStatus(userId, result);
      this.eventBus.emit(EVENTS.AGE_VERIFIED, { userId, method: record!.method, isAdult: result.isAdult });
      void this.audit.log({ userId, action: 'AGE_VERIFIED', resource: 'AgeVerification', resourceId: recordId });
    } else if (result.status === IdentityStatus.DECLINED) {
      this.eventBus.emit(EVENTS.AGE_DECLINED, { userId, reason: result.reason });
      void this.audit.log({ userId, action: 'AGE_DECLINED', resource: 'AgeVerification', resourceId: recordId });
    }
    // NEEDS_INPUT / REVIEW leave capabilities locked; REVIEW is picked up by the
    // admin queue.
  }

  /**
   * Writes the verified age back to the athlete/creator profile. The verification
   * result is AUTHORITATIVE over self-reported DOB — including the security-critical
   * case where someone claimed to be an adult to skip guardian consent but is a minor.
   */
  private async reconcileMinorStatus(userId: string, result: AgeResult) {
    const decided = decideMinor(result, this.threshold);
    if (decided === null) return; // couldn't determine — leave as-is

    const [creator, athlete] = await Promise.all([
      this.prisma.creator.findUnique({ where: { userId }, select: { id: true, isMinor: true } }),
      this.prisma.athlete.findUnique({ where: { userId }, select: { id: true, isMinor: true } }),
    ]);
    const owner = creator ? { kind: 'creator' as const, id: creator.id, wasMinor: creator.isMinor }
      : athlete ? { kind: 'athlete' as const, id: athlete.id, wasMinor: athlete.isMinor }
      : null;
    if (!owner) return;

    const data = { isMinor: decided.isMinor, ...(decided.dob ? { dateOfBirth: decided.dob } : {}) };
    if (owner.kind === 'creator') await this.prisma.creator.update({ where: { id: owner.id }, data });
    else await this.prisma.athlete.update({ where: { id: owner.id }, data });

    // Downgrade: verified as a minor after presenting as an adult — the case a
    // bad actor would try to slip through. Flag loudly.
    if (decided.isMinor && !owner.wasMinor) {
      this.eventBus.emit(EVENTS.MINOR_DOWNGRADED, { userId, ownerType: owner.kind, ownerId: owner.id });
      void this.audit.log({
        userId,
        action: 'MINOR_DOWNGRADED',
        resource: owner.kind === 'creator' ? 'Creator' : 'Athlete',
        resourceId: owner.id,
        newValue: { isMinor: true, source: 'age_verification' },
      });
      this.logger.warn(`Age verification downgraded ${owner.kind} ${owner.id} to minor — guardian consent now required.`);
    }
  }

  private async selfReportedDob(userId: string): Promise<Date | null> {
    const [creator, athlete] = await Promise.all([
      this.prisma.creator.findUnique({ where: { userId }, select: { dateOfBirth: true } }),
      this.prisma.athlete.findUnique({ where: { userId }, select: { dateOfBirth: true } }),
    ]);
    return creator?.dateOfBirth ?? athlete?.dateOfBirth ?? null;
  }
}

/** Resolve a minor decision from a provider result. Returns null if undecidable. */
function decideMinor(result: AgeResult, threshold: number): { isMinor: boolean; dob?: Date } | null {
  if (result.confirmedDob) {
    return { isMinor: ageInYears(result.confirmedDob) < threshold, dob: result.confirmedDob };
  }
  if (typeof result.isAdult === 'boolean') return { isMinor: !result.isAdult };
  if (typeof result.estimatedAge === 'number') return { isMinor: result.estimatedAge < threshold };
  return null;
}

function ageInYears(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
