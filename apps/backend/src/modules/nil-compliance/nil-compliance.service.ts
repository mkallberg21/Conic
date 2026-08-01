import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NilDisclosureStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateDisclosureDto } from './dto/create-disclosure.dto';
import { CreateNilDealDto, CreateAppearanceDto, ReviewDisclosureDto } from './dto/nil-deal.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NilComplianceService {
  private readonly logger = new Logger(NilComplianceService.name);
  private readonly nilAiUrl: string;
  private readonly internalSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly auditService: AuditService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.nilAiUrl = this.config.get<string>('NIL_COMPLIANCE_AI_URL', 'http://nil-compliance-ai:8007');
    this.internalSecret = this.config.get<string>('INTERNAL_API_SECRET', '');
  }

  // ─── Disclosures ────────────────────────────────────────────────────────────

  async createDisclosure(callerId: string, dto: CreateDisclosureDto) {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: dto.athleteId },
      include: { user: true, university: true },
    });
    if (!athlete) throw new NotFoundException('Athlete not found');

    // AI compliance analysis
    let aiAnalysis: {
      aiGeneratedSummary?: string;
      aiComplianceFlags?: unknown;
      aiStateRules?: unknown;
      aiNcaaRules?: unknown;
    } = {};
    try {
      const res = await firstValueFrom(
        this.httpService.post(
          `${this.nilAiUrl}/compliance/analyze-disclosure`,
          {
            athleteId: dto.athleteId,
            dealType: dto.dealType,
            brandName: dto.brandName,
            dealValueCents: dto.dealValueCents,
            platforms: dto.platforms ?? [],
            state: athlete.university?.state,
            division: athlete.university?.division,
            sport: athlete.sport,
          },
          { headers: { 'x-internal-secret': this.internalSecret } },
        ),
      );
      aiAnalysis = res.data;
    } catch (err) {
      this.logger.warn(`NIL AI analysis failed for disclosure creation: ${String(err)}`);
    }

    const disclosure = await this.prisma.nilDisclosure.create({
      data: {
        athleteId: dto.athleteId,
        universityId: dto.universityId,
        dealType: dto.dealType,
        brandName: dto.brandName,
        dealValueCents: dto.dealValueCents,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        description: dto.description,
        platforms: dto.platforms ?? [],
        contractUrl: dto.contractUrl,
        supportingDocUrls: dto.supportingDocUrls ?? [],
        status: NilDisclosureStatus.PENDING_REVIEW,
        submittedAt: new Date(),
        aiGeneratedSummary: aiAnalysis.aiGeneratedSummary,
        aiComplianceFlags: aiAnalysis.aiComplianceFlags as never,
        aiStateRules: aiAnalysis.aiStateRules as never,
        aiNcaaRules: aiAnalysis.aiNcaaRules as never,
      },
      include: { athlete: { include: { user: true, university: true } } },
    });

    this.eventBus.emit(EVENTS.NIL_DISCLOSURE_SUBMITTED, {
      disclosureId: disclosure.id,
      athleteId: dto.athleteId,
      universityId: dto.universityId,
      dealValueCents: dto.dealValueCents,
    });

    void this.auditService.log({
      userId: callerId,
      action: 'NIL_DISCLOSURE_CREATED',
      resource: 'NilDisclosure',
      resourceId: disclosure.id,
      newValue: { athleteId: dto.athleteId, dealType: dto.dealType, dealValueCents: dto.dealValueCents },
    });

    return disclosure;
  }

  async reviewDisclosure(callerId: string, dto: ReviewDisclosureDto) {
    const disclosure = await this.prisma.nilDisclosure.findUnique({
      where: { id: dto.disclosureId },
    });
    if (!disclosure) throw new NotFoundException('Disclosure not found');
    if (disclosure.status !== NilDisclosureStatus.PENDING_REVIEW) {
      throw new BadRequestException('Disclosure is not pending review');
    }

    const updated = await this.prisma.nilDisclosure.update({
      where: { id: dto.disclosureId },
      data: {
        status: dto.decision === 'APPROVED'
          ? NilDisclosureStatus.APPROVED
          : NilDisclosureStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: callerId,
        reviewNotes: dto.notes,
      },
    });

    this.eventBus.emit(
      dto.decision === 'APPROVED' ? EVENTS.NIL_DISCLOSURE_APPROVED : EVENTS.NIL_DISCLOSURE_REJECTED,
      { disclosureId: disclosure.id, athleteId: disclosure.athleteId },
    );

    void this.auditService.log({
      userId: callerId,
      action: `NIL_DISCLOSURE_${dto.decision}`,
      resource: 'NilDisclosure',
      resourceId: disclosure.id,
      newValue: { status: updated.status, notes: dto.notes },
    });

    return updated;
  }

  async getDisclosures(userId: string, role: UserRole, page = 1, take = 25) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 100);
    const limit = Math.min(Math.max(1, take), 100);

    let where: Record<string, unknown> = {};

    if (role === UserRole.ATHLETE) {
      const athlete = await this.prisma.athlete.findUnique({ where: { userId } });
      if (!athlete) return { items: [], total: 0, page, pageSize: limit, totalPages: 0 };
      where = { athleteId: athlete.id };
    } else if (role === UserRole.COMPLIANCE_OFFICER) {
      const officer = await this.prisma.complianceOfficer.findUnique({
        where: { userId }, select: { universityId: true },
      });
      if (!officer) return { items: [], total: 0, page, pageSize: limit, totalPages: 0 };
      where = { universityId: officer.universityId };
    } else if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.nilDisclosure.findMany({
        where,
        include: { athlete: { include: { user: { select: { firstName: true, lastName: true } }, university: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.nilDisclosure.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── NIL Deals ──────────────────────────────────────────────────────────────

  async createNilDeal(callerId: string, dto: CreateNilDealDto) {
    const athlete = await this.prisma.athlete.findUnique({ where: { id: dto.athleteId } });
    if (!athlete) throw new NotFoundException('Athlete not found');
    if (!athlete.nilActive) throw new ForbiddenException('Athlete is not enrolled in NIL program');

    // Check NIL cap if applicable
    if (athlete.nilCapCents !== null && dto.valueCents > 0) {
      const remaining = athlete.nilCapCents - athlete.nilEarnedYtdCents;
      if (dto.valueCents > remaining) {
        throw new BadRequestException(
          `Deal value $${(dto.valueCents / 100).toFixed(2)} exceeds remaining NIL annual cap $${(remaining / 100).toFixed(2)}`,
        );
      }
    }

    // AI risk assessment
    let aiRiskScore = 0;
    let aiRiskFlags: unknown = [];
    try {
      const res = await firstValueFrom(
        this.httpService.post(
          `${this.nilAiUrl}/compliance/assess-deal-risk`,
          {
            athleteId: dto.athleteId,
            dealType: dto.dealType,
            valueCents: dto.valueCents,
            brandId: dto.brandId,
            collectiveId: dto.collectiveId,
          },
          { headers: { 'x-internal-secret': this.internalSecret } },
        ),
      );
      aiRiskScore = res.data.riskScore ?? 0;
      aiRiskFlags = res.data.flags ?? [];
    } catch (err) {
      this.logger.warn(`NIL AI risk assessment failed: ${String(err)}`);
    }

    const deal = await this.prisma.nilDeal.create({
      data: {
        athleteId: dto.athleteId,
        collectiveId: dto.collectiveId,
        brandId: dto.brandId,
        title: dto.title,
        description: dto.description,
        dealType: dto.dealType,
        valueCents: dto.valueCents,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        disclosureId: dto.disclosureId,
        aiRiskScore,
        aiRiskFlags: aiRiskFlags as never,
        status: 'PENDING',
      },
      include: { athlete: { include: { user: true } }, brand: true, collective: true },
    });

    this.eventBus.emit(EVENTS.NIL_DEAL_CREATED, {
      dealId: deal.id,
      athleteId: dto.athleteId,
      valueCents: dto.valueCents,
      aiRiskScore,
    });

    void this.auditService.log({
      userId: callerId,
      action: 'NIL_DEAL_CREATED',
      resource: 'NilDeal',
      resourceId: deal.id,
      newValue: { dealType: dto.dealType, valueCents: dto.valueCents, aiRiskScore },
    });

    return deal;
  }

  async getNilDeals(userId: string, role: UserRole, page = 1, take = 25) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 100);
    const limit = Math.min(Math.max(1, take), 100);

    let where: Record<string, unknown> = {};
    if (role === UserRole.ATHLETE) {
      const athlete = await this.prisma.athlete.findUnique({ where: { userId } });
      if (!athlete) return { items: [], total: 0, page, pageSize: limit, totalPages: 0 };
      where = { athleteId: athlete.id };
    } else if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      if (!brand) return { items: [], total: 0, page, pageSize: limit, totalPages: 0 };
      where = { brandId: brand.id };
    } else if (role !== UserRole.ADMIN && role !== UserRole.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('Access denied');
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.nilDeal.findMany({
        where,
        include: {
          athlete: { include: { user: { select: { firstName: true, lastName: true } } } },
          brand: { select: { companyName: true, logoUrl: true } },
          collective: { select: { name: true } },
          fmvAssessment: { select: { fmvMinCents: true, fmvMaxCents: true, eligibilityRisk: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.nilDeal.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Appearances ────────────────────────────────────────────────────────────

  async createAppearance(callerId: string, dto: CreateAppearanceDto) {
    const athlete = await this.prisma.athlete.findUnique({ where: { id: dto.athleteId } });
    if (!athlete) throw new NotFoundException('Athlete not found');

    const appearance = await this.prisma.appearance.create({
      data: {
        athleteId: dto.athleteId,
        brandId: dto.brandId,
        nilDealId: dto.nilDealId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        venueName: dto.venueName,
        venueAddress: dto.venueAddress,
        city: dto.city,
        state: dto.state,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 60,
        compensationCents: dto.compensationCents,
        travelIncluded: dto.travelIncluded ?? false,
        travelDetails: dto.travelDetails as never,
        status: 'SCHEDULED',
      },
      include: { athlete: { include: { user: true } }, brand: true },
    });

    this.eventBus.emit(EVENTS.APPEARANCE_SCHEDULED, {
      appearanceId: appearance.id,
      athleteId: dto.athleteId,
      scheduledAt: dto.scheduledAt,
      compensationCents: dto.compensationCents,
    });

    void this.auditService.log({
      userId: callerId,
      action: 'APPEARANCE_CREATED',
      resource: 'Appearance',
      resourceId: appearance.id,
      newValue: { type: dto.type, scheduledAt: dto.scheduledAt, compensationCents: dto.compensationCents },
    });

    return appearance;
  }

  // ─── FMV Assessment ─────────────────────────────────────────────────────────

  async requestFmvAssessment(
    callerId: string,
    athleteId: string,
    dealType: string,
    platform?: string,
  ) {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { university: true },
    });
    if (!athlete) throw new NotFoundException('Athlete not found');

    let fmvResult: {
      fmvMinCents?: number;
      fmvMaxCents?: number;
      fmvMedianCents?: number;
      confidenceScore?: number;
      eligibilityRisk?: string;
      comparableDeals?: unknown;
      rawFactors?: unknown;
      riskFlags?: unknown;
    } = {
      fmvMinCents: 50000,
      fmvMaxCents: 500000,
      fmvMedianCents: 150000,
      confidenceScore: 0.5,
      eligibilityRisk: 'low',
    };

    try {
      const res = await firstValueFrom(
        this.httpService.post(
          `${this.nilAiUrl}/fmv/assess`,
          {
            athleteId,
            sport: athlete.sport,
            followersCount: athlete.followersCount,
            engagementRate: athlete.engagementRate,
            audienceScore: athlete.audienceScore,
            division: athlete.university?.division,
            conferenceLevel: athlete.university?.conference,
            dealType,
            platform,
          },
          { headers: { 'x-internal-secret': this.internalSecret } },
        ),
      );
      fmvResult = res.data;
    } catch (err) {
      this.logger.warn(`FMV AI assessment failed: ${String(err)}`);
    }

    const assessment = await this.prisma.$transaction(async (tx) => {
      const record = await tx.fmvAssessment.create({
        data: {
          athleteId,
          dealType,
          sport: athlete.sport,
          platform,
          followersCount: athlete.followersCount,
          engagementRate: athlete.engagementRate,
          fmvMinCents: fmvResult.fmvMinCents ?? 50000,
          fmvMaxCents: fmvResult.fmvMaxCents ?? 500000,
          fmvMedianCents: fmvResult.fmvMedianCents ?? 150000,
          confidenceScore: fmvResult.confidenceScore ?? 0.5,
          eligibilityRisk: fmvResult.eligibilityRisk,
          comparableDeals: fmvResult.comparableDeals as never,
          rawFactors: fmvResult.rawFactors as never,
          riskFlags: fmvResult.riskFlags as never,
          aiModel: 'nil-fmv-v1',
        },
      });

      // Update athlete FMV cache
      await tx.athlete.update({
        where: { id: athleteId },
        data: {
          fmvMinCents: record.fmvMinCents,
          fmvMaxCents: record.fmvMaxCents,
          fmvLastAssessedAt: new Date(),
        },
      });

      return record;
    });

    void this.auditService.log({
      userId: callerId,
      action: 'FMV_ASSESSMENT_REQUESTED',
      resource: 'FmvAssessment',
      resourceId: assessment.id,
      newValue: {
        athleteId,
        dealType,
        fmvMinCents: assessment.fmvMinCents,
        fmvMaxCents: assessment.fmvMaxCents,
      },
    });

    return assessment;
  }

  // ─── Eligibility Check ──────────────────────────────────────────────────────

  async checkEligibility(userId: string, role: UserRole, athleteId: string) {
    if (role !== UserRole.ATHLETE && role !== UserRole.ADMIN && role !== UserRole.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('Access denied');
    }

    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        university: true,
        nilDisclosures: { where: { status: 'PENDING_REVIEW' }, select: { id: true } },
        nilDeals: {
          where: { status: 'ACTIVE' },
          select: { id: true, valueCents: true, dealType: true },
        },
      },
    });
    if (!athlete) throw new NotFoundException('Athlete not found');

    const nilEarnedYtd = athlete.nilEarnedYtdCents;
    const nilCap = athlete.nilCapCents;
    const capRemaining = nilCap !== null ? nilCap - nilEarnedYtd : null;
    const pendingDisclosures = athlete.nilDisclosures.length;

    let aiEligibilityAnalysis: unknown = null;
    try {
      const res = await firstValueFrom(
        this.httpService.post(
          `${this.nilAiUrl}/compliance/check-eligibility`,
          {
            athleteId,
            status: athlete.status,
            eligibilityStatus: athlete.eligibilityStatus,
            division: athlete.university?.division,
            state: athlete.university?.state,
            nilEarnedYtdCents: nilEarnedYtd,
            nilCapCents: nilCap,
            activeDeals: athlete.nilDeals,
            pendingDisclosures,
          },
          { headers: { 'x-internal-secret': this.internalSecret } },
        ),
      );
      aiEligibilityAnalysis = res.data;
    } catch (err) {
      this.logger.warn(`Eligibility AI check failed: ${String(err)}`);
    }

    return {
      athleteId,
      isEligible: athlete.eligibilityStatus === 'ELIGIBLE',
      eligibilityStatus: athlete.eligibilityStatus,
      athleteStatus: athlete.status,
      nilActive: athlete.nilActive,
      nilEarnedYtdCents: nilEarnedYtd,
      nilCapCents: nilCap,
      nilCapRemainingCents: capRemaining,
      nilCapUtilizationPct: nilCap ? Math.round((nilEarnedYtd / nilCap) * 100) : null,
      activeDealsCount: athlete.nilDeals.length,
      pendingDisclosuresCount: pendingDisclosures,
      aiAnalysis: aiEligibilityAnalysis,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  // ─── Compliance Report Generation ───────────────────────────────────────────

  async generateComplianceReport(
    callerId: string,
    universityId: string,
    reportType: string,
    period: string,
  ) {
    const university = await this.prisma.university.findUnique({ where: { id: universityId } });
    if (!university) throw new NotFoundException('University not found');

    // Aggregate data for reporting period
    const [startDate, endDate] = this.parsePeriod(period, reportType);

    const [disclosures, nilDeals, athletes] = await Promise.all([
      this.prisma.nilDisclosure.findMany({
        where: { universityId, createdAt: { gte: startDate, lte: endDate } },
        include: { athlete: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.nilDeal.findMany({
        where: {
          athlete: { universityId },
          createdAt: { gte: startDate, lte: endDate },
        },
        include: { athlete: { include: { user: { select: { firstName: true, lastName: true } }, university: true } } },
      }),
      this.prisma.athlete.findMany({
        where: { universityId, nilActive: true },
        select: { id: true, sport: true, nilEarnedYtdCents: true, status: true },
      }),
    ]);

    const totalValueCents = nilDeals.reduce((sum, d) => sum + d.valueCents, 0);
    const dealsByType = nilDeals.reduce<Record<string, number>>((acc, d) => {
      acc[d.dealType] = (acc[d.dealType] ?? 0) + 1;
      return acc;
    }, {});
    const dealsBySport = nilDeals.reduce<Record<string, number>>((acc, d) => {
      const sport = d.athlete.sport;
      acc[sport] = (acc[sport] ?? 0) + 1;
      return acc;
    }, {});
    const flaggedDeals = nilDeals.filter((d) => (d.aiRiskScore ?? 0) > 70).length;
    const pendingDisclosures = disclosures.filter((d) => d.status === 'PENDING_REVIEW').length;

    // AI narrative generation
    let aiSummary = '';
    let aiRiskNarrative = '';
    let aiRecommendations: unknown = [];
    try {
      const res = await firstValueFrom(
        this.httpService.post(
          `${this.nilAiUrl}/reports/generate-narrative`,
          {
            universityName: university.name,
            reportType,
            period,
            athleteCount: athletes.length,
            dealCount: nilDeals.length,
            totalValueCents,
            disclosureCount: disclosures.length,
            pendingDisclosures,
            flaggedDeals,
            dealsByType,
            dealsBySport,
          },
          { headers: { 'x-internal-secret': this.internalSecret } },
        ),
      );
      aiSummary = res.data.summary ?? '';
      aiRiskNarrative = res.data.riskNarrative ?? '';
      aiRecommendations = res.data.recommendations ?? [];
    } catch (err) {
      this.logger.warn(`AI narrative generation failed: ${String(err)}`);
    }

    const report = await this.prisma.complianceReport.create({
      data: {
        universityId,
        reportType,
        period,
        status: 'DRAFT',
        athleteCount: athletes.length,
        dealCount: nilDeals.length,
        totalValueCents,
        disclosureCount: disclosures.length,
        pendingDisclosures,
        flaggedDeals,
        aiSummary,
        aiRiskNarrative,
        aiRecommendations: aiRecommendations as never,
        dealsByType,
        dealsBySport,
      },
      include: { university: { select: { name: true } } },
    });

    this.eventBus.emit(EVENTS.COMPLIANCE_REPORT_GENERATED, {
      reportId: report.id,
      universityId,
      reportType,
      period,
    });

    void this.auditService.log({
      userId: callerId,
      action: 'COMPLIANCE_REPORT_GENERATED',
      resource: 'ComplianceReport',
      resourceId: report.id,
      newValue: { universityId, reportType, period, dealCount: nilDeals.length, totalValueCents },
    });

    return report;
  }

  async getComplianceReports(universityId: string, page = 1, take = 20) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 50);
    const limit = Math.min(Math.max(1, take), 50);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.complianceReport.findMany({
        where: { universityId },
        include: { university: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.complianceReport.count({ where: { universityId } }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private parsePeriod(period: string, reportType: string): [Date, Date] {
    const now = new Date();
    if (reportType === 'monthly') {
      const [year, month] = period.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      return [start, end];
    }
    if (reportType === 'quarterly') {
      const [year, q] = period.split('-Q').map(Number);
      const startMonth = (q - 1) * 3;
      const start = new Date(year, startMonth, 1);
      const end = new Date(year, startMonth + 3, 0, 23, 59, 59);
      return [start, end];
    }
    // annual
    const year = parseInt(period, 10) || now.getFullYear();
    return [new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59)];
  }
}
