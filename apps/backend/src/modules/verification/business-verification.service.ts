import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IdentityStatus, KybTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { BusinessVerifier, KybResult } from './providers/business-verifier';
import { StartKybDto } from './dto/verification.dto';

@Injectable()
export class BusinessVerificationService {
  private readonly logger = new Logger(BusinessVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifier: BusinessVerifier,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async getStatus(brandUserId: string) {
    const brand = await this.requireBrand(brandUserId);
    const check = await this.prisma.businessVerification.findUnique({ where: { brandId: brand.id } });
    return { tier: brand.kybTier, status: brand.kybStatus, check };
  }

  async start(brandUserId: string, dto: StartKybDto) {
    const brand = await this.requireBrand(brandUserId);

    // ENHANCED (minor-contact) tier requires the youth-safety terms to be accepted.
    if (dto.tier === KybTier.ENHANCED && !dto.youthSafetyAccepted) {
      throw new ForbiddenException('You must accept the youth-safety terms to request minor-contact access.');
    }

    const submitted = await this.verifier.submit({
      brandId: brand.id,
      legalName: dto.legalName,
      registrationNumber: dto.registrationNumber,
      country: dto.country,
      domain: dto.domain,
      tier: dto.tier,
    });

    await this.prisma.businessVerification.upsert({
      where: { brandId: brand.id },
      update: {
        tier: dto.tier,
        status: submitted.result.status,
        provider: this.verifier.name,
        providerCase: submitted.caseId,
        legalName: dto.legalName,
        registrationNumber: dto.registrationNumber,
        country: dto.country,
        domain: dto.domain,
        youthSafetyAccepted: dto.youthSafetyAccepted ?? false,
        failureReason: submitted.result.reason,
        decidedAt: null,
      },
      create: {
        brandId: brand.id,
        tier: dto.tier,
        status: submitted.result.status,
        provider: this.verifier.name,
        providerCase: submitted.caseId,
        legalName: dto.legalName,
        registrationNumber: dto.registrationNumber,
        country: dto.country,
        domain: dto.domain,
        youthSafetyAccepted: dto.youthSafetyAccepted ?? false,
        failureReason: submitted.result.reason,
      },
    });

    await this.prisma.brand.update({ where: { id: brand.id }, data: { kybStatus: submitted.result.status } });

    if (submitted.result.status !== IdentityStatus.PENDING) {
      await this.finalize(brand.id, submitted.caseId, dto.tier, submitted.result);
    }
    return this.getStatus(brandUserId);
  }

  async handleWebhook(headers: Record<string, string>, raw: Buffer) {
    const { caseId, result } = this.verifier.parseWebhook(headers, raw);
    const check = await this.prisma.businessVerification.findUnique({ where: { providerCase: caseId } });
    if (!check) {
      this.logger.warn(`KYB webhook for unknown case ${caseId}`);
      return { ok: true };
    }
    if (check.decidedAt) return { ok: true }; // idempotent
    await this.finalize(check.brandId, caseId, check.tier, result);
    return { ok: true };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async finalize(brandId: string, caseId: string, requestedTier: KybTier, result: KybResult) {
    await this.prisma.businessVerification.update({
      where: { providerCase: caseId },
      data: {
        status: result.status,
        matchedName: result.matchedName,
        riskScore: result.riskScore,
        sanctionsHit: result.sanctionsHit ?? false,
        beneficialOwnersOk: result.beneficialOwnersOk ?? false,
        failureReason: result.reason,
        decidedAt: new Date(),
      },
    });

    // A sanctions hit is never auto-approved — force review even if the vendor passed it.
    const approved = result.status === IdentityStatus.APPROVED && !result.sanctionsHit;
    const grantedTier = approved ? requestedTier : KybTier.NONE;
    const finalStatus = result.sanctionsHit ? IdentityStatus.REVIEW : result.status;

    await this.prisma.brand.update({
      where: { id: brandId },
      data: { kybTier: grantedTier, kybStatus: finalStatus },
    });

    if (approved) {
      this.eventBus.emit(EVENTS.KYB_APPROVED, { brandId, tier: grantedTier });
      void this.audit.log({ action: 'KYB_APPROVED', resource: 'Brand', resourceId: brandId, newValue: { tier: grantedTier } });
    } else if (finalStatus === IdentityStatus.REVIEW || finalStatus === IdentityStatus.DECLINED) {
      this.eventBus.emit(EVENTS.KYB_FLAGGED, { brandId, status: finalStatus, sanctionsHit: result.sanctionsHit });
      void this.audit.log({ action: 'KYB_FLAGGED', resource: 'Brand', resourceId: brandId, newValue: { status: finalStatus } });
    }
  }

  private async requireBrand(brandUserId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { userId: brandUserId },
      select: { id: true, kybTier: true, kybStatus: true },
    });
    if (!brand) throw new NotFoundException('Brand profile not found');
    return brand;
  }
}
