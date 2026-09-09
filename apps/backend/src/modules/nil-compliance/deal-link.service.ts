import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { AuditService } from '../../common/audit/audit.service';
import { GuardianService } from '../guardian/guardian.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import {
  ContributorType,
  CreateDealLinkDto,
  CreatePreDisclosureDealLinkDto,
  ContributeDto,
  DealTypeEnum,
} from './dto/deal-link.dto';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

function generateLinkToken(): string {
  // Opaque, URL-safe, 48 chars — same size class as guardian invite tokens.
  return 'dl_' + randomBytes(24).toString('base64url');
}

// ─── Service ─────────────────────────────────────────────────────────────────────

@Injectable()
export class DealLinkService {
  private readonly logger = new Logger(DealLinkService.name);
  private readonly nilAiUrl: string;
  private readonly internalSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly auditService: AuditService,
    private readonly guardianService: GuardianService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.nilAiUrl = this.config.get<string>('NIL_COMPLIANCE_AI_URL', 'http://nil-compliance-ai:8007');
    this.internalSecret = this.config.get<string>('INTERNAL_API_SECRET', '');
    this.frontendUrl = this.config.get<string>('app.frontendUrl') ?? 'https://app.conic.io';
  }

  // ─── Owner-facing: create DealLink on existing disclosure ───────────────────

  async createDealLink(
    callerId: string,
    disclosureId: string,
    dto: CreateDealLinkDto,
  ) {
    const disclosure = await this.prisma.nilDisclosure.findUnique({
      where: { id: disclosureId },
      include: { athlete: { include: { user: true } } },
    });
    if (!disclosure) throw new NotFoundException('Disclosure not found');

    // Revoke any existing active DealLink on this disclosure.
    await this.prisma.dealLink.updateMany({
      where: { disclosureId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const maxContributions = dto.maxContributions ?? 5;
    const expiresInHours = dto.expiresInHours ?? 168;
    const rawToken = generateLinkToken();
    const tokenHash = sha256(rawToken);

    const dealLink = await this.prisma.dealLink.create({
      data: {
        disclosureId,
        linkTokenHash: tokenHash,
        rawToken,
        contributorType: dto.contributorType,
        contributorLabel: dto.contributorLabel ?? null,
        maxContributions,
        remainingContributions: maxContributions,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      },
    });

    const submissionUrl = `${this.frontendUrl}/deal-link/${rawToken}`;

    void this.auditService.log({
      userId: callerId,
      action: 'DEAL_LINK_CREATED',
      resource: 'DealLink',
      resourceId: dealLink.id,
      newValue: {
        disclosureId,
        contributorType: dto.contributorType,
        maxContributions,
        expiresAt: dealLink.expiresAt,
      },
    });

    return {
      dealLinkId: dealLink.id,
      linkToken: rawToken,
      submissionUrl,
      maxContributions,
      remainingContributions: maxContributions,
      expiresAt: dealLink.expiresAt,
    };
  }

  // ─── Owner-facing: get active DealLink on a disclosure ───────────────────────

  async findActiveByDisclosure(disclosureId: string) {
    const dealLink = await this.prisma.dealLink.findFirst({
      where: { disclosureId, revokedAt: null },
    });
    if (!dealLink) return null;
    const submissionUrl = `${this.frontendUrl}/deal-link/${dealLink.rawToken}`;
    return { ...dealLink, submissionUrl };
  }

  // ─── Owner-facing: revoke ─────────────────────────────────────────────────────

  async revokeDealLink(callerId: string, disclosureId: string) {
    const disclosed = await this.prisma.nilDisclosure.findUnique({
      where: { id: disclosureId },
      include: { athlete: { include: { user: true } } },
    });
    if (!disclosed) throw new NotFoundException('Disclosure not found');

    const before = await this.prisma.dealLink.findFirst({
      where: { disclosureId, revokedAt: null },
    });
    if (!before) return { revoked: false, message: 'No active DealLink to revoke' };

    await this.prisma.dealLink.update({
      where: { id: before.id },
      data: { revokedAt: new Date() },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'DEAL_LINK_REVOKED',
      resource: 'DealLink',
      resourceId: before.id,
      newValue: { disclosureId },
    });

    return { revoked: true, dealLinkId: before.id };
  }

  // ─── Owner-facing: renew ──────────────────────────────────────────────────────

  async renewDealLink(callerId: string, disclosureId: string, dto: { expiresInHours?: number }) {
    const disclosed = await this.prisma.nilDisclosure.findUnique({
      where: { id: disclosureId },
    });
    if (!disclosed) throw new NotFoundException('Disclosure not found');

    const existing = await this.prisma.dealLink.findFirst({
      where: { disclosureId, revokedAt: null },
    });
    if (!existing) throw new BadRequestException('No active DealLink to renew');

    const expiresInHours = dto.expiresInHours ?? 168;
    const rawToken = generateLinkToken();
    const tokenHash = sha256(rawToken);

    const renewed = await this.prisma.dealLink.update({
      where: { id: existing.id },
      data: {
        linkTokenHash: tokenHash,
        remainingContributions: existing.maxContributions,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'DEAL_LINK_RENEWED',
      resource: 'DealLink',
      resourceId: renewed.id,
      newValue: { disclosureId, expiresAt: renewed.expiresAt },
    });

    const submissionUrl = `${this.frontendUrl}/deal-link/${rawToken}`;

    return {
      dealLinkId: renewed.id,
      linkToken: rawToken,
      submissionUrl,
      maxContributions: renewed.maxContributions,
      remainingContributions: renewed.maxContributions,
      expiresAt: renewed.expiresAt,
    };
  }

  // ─── No-auth: look up a DealLink by raw token ────────────────────────────────

  async lookupByToken(rawToken: string) {
    const hash = sha256(rawToken);
    const dealLink = await this.prisma.dealLink.findUnique({
      where: { linkTokenHash: hash },
      include: {
        disclosure: {
          include: {
            athlete: { include: { user: { select: { firstName: true, lastName: true } }, university: { select: { name: true, state: true } } } },
            reviewedByUser: { select: { firstName: true, lastName: true } },
          },
        },
        contributions: {
          orderBy: { submittedAt: 'desc' },
          select: { id: true, contributorType: true, contributorLabel: true, submittedAt: true, fields: true },
        },
      },
    });
    if (!dealLink) throw new NotFoundException('DealLink not found');
    if (dealLink.revokedAt) throw new BadRequestException('This DealLink has been revoked');
    if (new Date() > dealLink.expiresAt) throw new BadRequestException('This DealLink has expired');
    return dealLink;
  }

  // ─── No-auth: contribute ──────────────────────────────────────────────────────

  async contribute(rawToken: string, dto: ContributeDto, ipAddress?: string) {
    const dealLink = await this.lookupByToken(rawToken);
    if (dealLink.remainingContributions <= 0) {
      throw new BadRequestException('Contribution limit reached for this DealLink');
    }

    const disclosure = dealLink.disclosure;

    // Pre-disclosure links (no disclosure yet) are not supported in this schema shape.
    // The owner creates the disclosure first, then shares the DealLink.
    if (!disclosure) {
      throw new BadRequestException('This DealLink is not attached to a disclosure yet');
    }

    // ── Merge contribution into the disclosure ────────────────────────────────
    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.nilDisclosure.findUnique({
        where: { id: disclosure.id },
        select: { status: true, athleteId: true, universityId: true },
      });

      // Build merged field set from existing + new contribution.
      const mergedPlatforms = Array.from(
        new Set([
          ...(disclosure.platforms ?? []),
          ...(dto.platforms ?? []),
        ]),
      );
      const mergedDocUrls = Array.from(
        new Set([
          ...(disclosure.supportingDocUrls ?? []),
          ...(dto.supportingDocUrls ?? []),
        ]),
      );

      const updatedDisclosure = await tx.nilDisclosure.update({
        where: { id: disclosure.id },
        data: {
          dealType: dto.dealType,
          brandName: dto.brandName,
          dealValueCents: dto.dealValueCents,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          description: dto.description ?? disclosure.description,
          platforms: mergedPlatforms,
          contractUrl: dto.contractUrl ?? disclosure.contractUrl,
          supportingDocUrls: mergedDocUrls,
          status: before?.status === 'APPROVED' || before?.status === 'REJECTED'
            ? before.status
            : 'PENDING_REVIEW',
          submittedAt: disclosure.submittedAt ?? new Date(),
        },
        include: { athlete: { include: { user: true, university: true } } },
      });

      // Snapshot this contribution.
      const contribution = await tx.dealLinkContribution.create({
        data: {
          dealLinkId: dealLink.id,
          contributorType: dealLink.contributorType,
          contributorLabel: dealLink.contributorLabel,
          ipAddress: ipAddress ?? null,
          fields: {
            dealType: dto.dealType,
            brandName: dto.brandName,
            dealValueCents: dto.dealValueCents,
            startDate: dto.startDate,
            endDate: dto.endDate,
            description: dto.description,
            platforms: dto.platforms,
            contractUrl: dto.contractUrl,
            contributorNotes: dto.contributorNotes,
          },
        },
      });

      // Decrement remaining contributions.
      await tx.dealLink.update({
        where: { id: dealLink.id },
        data: { remainingContributions: { decrement: 1 } },
      });

      // Mark accepted time on first contribution.
      if (!dealLink.acceptedAt) {
        await tx.dealLink.update({
          where: { id: dealLink.id },
          data: { acceptedAt: new Date() },
        });
      }

      return { updatedDisclosure, contribution };
    });

    // ── Re-run AI compliance analysis on the merged state ─────────────────────
    let aiAnalysis = {} as {
      aiGeneratedSummary?: string;
      aiComplianceFlags?: unknown;
      aiStateRules?: unknown;
      aiNcaaRules?: unknown;
      riskLevel?: string;
    };
    try {
      const res = await firstValueFrom(
        this.httpService.post(
          `${this.nilAiUrl}/compliance/analyze-disclosure`,
          {
            athleteId: updated.updatedDisclosure.athleteId,
            dealType: updated.updatedDisclosure.dealType,
            brandName: updated.updatedDisclosure.brandName,
            dealValueCents: updated.updatedDisclosure.dealValueCents,
            platforms: updated.updatedDisclosure.platforms ?? [],
            state: updated.updatedDisclosure.athlete?.university?.state,
            division: updated.updatedDisclosure.athlete?.university?.division,
            sport: updated.updatedDisclosure.athlete?.sport,
          },
          { headers: { 'x-internal-secret': this.internalSecret } },
        ),
      );
      aiAnalysis = res.data;
    } catch (err) {
      this.logger.warn(`DealLink AI analysis failed for disclosure ${disclosure.id}: ${String(err)}`);
    }

    // Update AI fields on the disclosure.
    await this.prisma.nilDisclosure.update({
      where: { id: disclosure.id },
      data: {
        aiGeneratedSummary: aiAnalysis.aiGeneratedSummary ?? disclosure.aiGeneratedSummary,
        aiComplianceFlags: aiAnalysis.aiComplianceFlags as never,
        aiStateRules: aiAnalysis.aiStateRules as never,
        aiNcaaRules: aiAnalysis.aiNcaaRules as never,
      },
    });

    // Emit event.
    this.eventBus.emit(EVENTS.NIL_DISCLOSURE_SUBMITTED, {
      disclosureId: disclosure.id,
      athleteId: disclosure.athleteId,
      universityId: disclosure.universityId,
      dealValueCents: dto.dealValueCents,
    });

    // ── Guardian fan-out if the athlete is a minor ─────────────────────────────
    if (updated.updatedDisclosure.athlete?.isMinor) {
      try {
        await this.guardianService.requestApproval('nil_deal', disclosure.id, { athleteId: disclosure.athleteId });
      } catch (err) {
        this.logger.warn(`Guardian approval request failed for disclosure ${disclosure.id}: ${String(err)}`);
      }
    }

    // Audit.
    void this.auditService.log({
      userId: null,
      action: 'DEAL_LINK_CONTRIBUTION',
      resource: 'DealLink',
      resourceId: dealLink.id,
      newValue: {
        contributorType: dealLink.contributorType,
        contributorLabel: dealLink.contributorLabel,
        contributionId: updated.contribution.id,
        fields: updated.contribution.fields,
      },
      ipAddress,
    });

    // Return the disclosure in its post-contribution state.
    return this.prisma.nilDisclosure.findUnique({
      where: { id: disclosure.id },
      include: {
        athlete: { include: { user: { select: { firstName: true, lastName: true } }, university: { select: { name: true, state: true } } } },
        dealLink: {
          include: { contributions: { orderBy: { submittedAt: 'desc' }, take: 5 } },
        },
      },
    });
  }

  // ─── Pre-disclosure DealLink (creates disclosure on first contribution) ──────
  //
  // Follow-up to the primary implementation. Requires the schema change documented in
  // deallink-spec.md (DealLink.athleteId + nullable disclosure FK). The endpoint is wired
  // now so the frontend can call it once the backend supports it.

  async createPreDisclosureDealLink(
    callerId: string,
    dto: CreatePreDisclosureDealLinkDto,
  ) {
    throw new BadRequestException(
      'Pre-disclosure DealLinks require a schema update (DealLink.athleteId + nullable disclosure FK). See deallink-spec.md.',
    );
  }

  // ─── Public read: disclosure behind a link (no auth) ─────────────────────────

  async getDisclosureByToken(rawToken: string) {
    const dealLink = await this.lookupByToken(rawToken);
    return {
      dealLinkId: dealLink.id,
      disclosureId: dealLink.disclosureId,
      status: dealLink.disclosure?.status,
      submittedAt: dealLink.disclosure?.submittedAt,
      contributorType: dealLink.contributorType,
      contributorLabel: dealLink.contributorLabel,
      contributions: dealLink.contributions.map((c) => ({
        id: c.id,
        contributorType: c.contributorType,
        contributorLabel: c.contributorLabel,
        submittedAt: c.submittedAt,
        hasNotes: !!c.fields?.contributorNotes,
      })),
      remainingContributions: dealLink.remainingContributions,
      expiresAt: dealLink.expiresAt,
      acceptedAt: dealLink.acceptedAt,
    };
  }

  // ─── Build submission URL (owner GET uses this to display the issued URL) ────
  //
  // We store only the hash, not the raw token. The raw token is returned at creation
  // time and the caller retains it. This method reconstructs the URL for the owner
  // GET endpoint — but since we don't store the raw token, the owner must pass it in.
  // We store the raw token in a new column so the owner GET can display it.

  buildSubmissionUrl(dealLinkId: string): string {
    const dealLink = this.prisma.dealLink.findUnique({
      where: { id: dealLinkId },
      select: { linkTokenHash: true },
    });
    // The raw token isn't recoverable from the hash. The owner GET endpoint should
    // return the submissionUrl that was returned at creation time, stored in a new
    // column. This is a known limitation noted in the spec.
    throw new Error(
      'buildSubmissionUrl: raw token not stored. Add DealLink.rawToken column to persist the issued URL.',
    );
  }
}
