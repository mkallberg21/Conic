import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MatchStatus, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateMatchRequestDto } from './dto/matchmaking.dto';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly graphAiUrl: string;
  private readonly perfAiUrl: string;
  private readonly internalSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.graphAiUrl = this.config.get<string>('CREATOR_GRAPH_AI_URL', 'http://creator-graph-ai:8003');
    this.perfAiUrl = this.config.get<string>('PERFORMANCE_AI_URL', 'http://performance-prediction-ai:8006');
    this.internalSecret = this.config.get<string>('INTERNAL_API_SECRET', '');
  }

  async createRequest(callerId: string, dto: CreateMatchRequestDto) {
    const request = await this.prisma.matchRequest.create({
      data: {
        requestedById: callerId,
        campaignId: dto.campaignId,
        brief: dto.brief,
        budgetCents: dto.budgetCents,
        targetNiche: dto.targetNiche ?? [],
        targetPlatforms: dto.targetPlatforms ?? [],
        targetMinFollowers: dto.targetMinFollowers,
        targetMaxFollowers: dto.targetMaxFollowers,
        targetMinEngagement: dto.targetMinEngagement,
        targetEntityType: dto.targetEntityType ?? 'creator',
        targetSport: dto.targetSport,
        maxResults: dto.maxResults ?? 10,
        status: MatchStatus.PENDING,
      },
    });

    // Run matching asynchronously — return the request immediately
    void this.runMatching(request.id).catch((err) => {
      this.logger.error(`Matchmaking failed for request ${request.id}: ${String(err)}`);
    });

    void this.auditService.log({
      userId: callerId,
      action: 'MATCH_REQUEST_CREATED',
      resource: 'MatchRequest',
      resourceId: request.id,
      newValue: { entityType: dto.targetEntityType, brief: dto.brief.slice(0, 100) },
    });

    return request;
  }

  async getRequest(requestId: string, callerId: string, callerRole: UserRole) {
    const request = await this.prisma.matchRequest.findUnique({
      where: { id: requestId },
      include: {
        results: {
          include: {
            creator: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
            athlete: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!request) throw new NotFoundException('Match request not found');
    if (callerRole !== UserRole.ADMIN && request.requestedById !== callerId) {
      throw new NotFoundException('Match request not found');
    }

    return request;
  }

  async listRequests(callerId: string, callerRole: UserRole) {
    const where = callerRole === UserRole.ADMIN ? {} : { requestedById: callerId };
    return this.prisma.matchRequest.findMany({
      where,
      include: {
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Core Matching Engine ──────────────────────────────────────────────────

  private async runMatching(requestId: string) {
    await this.prisma.matchRequest.update({
      where: { id: requestId },
      data: { status: MatchStatus.PROCESSING },
    });

    try {
      const request = await this.prisma.matchRequest.findUnique({ where: { id: requestId } });
      if (!request) return;

      const includeCreators = ['creator', 'both'].includes(request.targetEntityType);
      const includeAthletes = ['athlete', 'both'].includes(request.targetEntityType);

      const [creators, athletes] = await Promise.all([
        includeCreators ? this.fetchCandidateCreators(request) : [],
        includeAthletes ? this.fetchCandidateAthletes(request) : [],
      ]);

      // Score each candidate using existing AI predictions
      const scoredCreators = await this.scoreCreators(creators, request.brief);
      const scoredAthletes = await this.scoreAthletes(athletes, request.brief);

      // Merge, sort by matchScore, take top N
      const combined = [...scoredCreators, ...scoredAthletes]
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, request.maxResults);

      await this.prisma.$transaction(async (tx) => {
        await tx.matchResult.createMany({
          data: combined.map((c, idx) => ({
            requestId,
            creatorId: c.creatorId ?? null,
            athleteId: c.athleteId ?? null,
            rank: idx + 1,
            matchScore: c.matchScore,
            audienceAlignScore: c.audienceAlignScore,
            performanceScore: c.performanceScore,
            fraudScore: c.fraudScore,
            suggestedRateCents: c.suggestedRateCents,
            estimatedReach: c.estimatedReach,
            estimatedRoi: c.estimatedRoi,
            reasoning: c.reasoning,
            aiFlags: c.aiFlags ? c.aiFlags : Prisma.JsonNull,
          })),
        });

        await tx.matchRequest.update({
          where: { id: requestId },
          data: { status: MatchStatus.COMPLETED },
        });
      });
    } catch (err) {
      await this.prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: MatchStatus.FAILED },
      });
      throw err;
    }
  }

  private async fetchCandidateCreators(request: {
    targetNiche: string[];
    targetPlatforms: string[];
    targetMinFollowers: number | null;
    targetMaxFollowers: number | null;
    targetMinEngagement: number | null;
    budgetCents: number | null;
  }) {
    return this.prisma.creator.findMany({
      where: {
        isVerified: true,
        fraudScore: { lte: 60 },
        ...(request.targetNiche.length > 0 ? { niche: { hasSome: request.targetNiche } } : {}),
        ...(request.targetPlatforms.length > 0
          ? { primaryPlatform: { in: request.targetPlatforms } }
          : {}),
        ...(request.targetMinFollowers != null
          ? { followersCount: { gte: request.targetMinFollowers } }
          : {}),
        ...(request.targetMaxFollowers != null
          ? { followersCount: { lte: request.targetMaxFollowers } }
          : {}),
        ...(request.targetMinEngagement != null
          ? { engagementRate: { gte: request.targetMinEngagement } }
          : {}),
      },
      include: { predictions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { performanceScore: 'desc' },
      take: 100,
    });
  }

  private async fetchCandidateAthletes(request: {
    targetSport: string | null;
    targetMinFollowers: number | null;
    targetMaxFollowers: number | null;
  }) {
    return this.prisma.athlete.findMany({
      where: {
        nilActive: true,
        isVerified: true,
        fraudScore: { lte: 60 },
        marketplaceListing: { isVisible: true },
        ...(request.targetSport ? { sport: request.targetSport } : {}),
        ...(request.targetMinFollowers != null
          ? { followersCount: { gte: request.targetMinFollowers } }
          : {}),
        ...(request.targetMaxFollowers != null
          ? { followersCount: { lte: request.targetMaxFollowers } }
          : {}),
      },
      include: { marketplaceListing: true },
      orderBy: { performanceScore: 'desc' },
      take: 100,
    });
  }

  private async scoreCreators(creators: Array<{
    id: string;
    performanceScore: number;
    audienceScore: number;
    fraudScore: number;
    followersCount: number;
    engagementRate: number;
    niche: string[];
    predictions: Array<{ predictedReach: number; predictedROI: number }>;
  }>, brief: string) {
    return creators.map((c) => {
      const perf = c.predictions[0];
      const matchScore = Math.round(
        (c.performanceScore * 0.4) +
        (c.audienceScore * 0.3) +
        ((100 - c.fraudScore) * 0.3),
      );

      return {
        creatorId: c.id,
        athleteId: undefined as string | undefined,
        matchScore,
        audienceAlignScore: c.audienceScore,
        performanceScore: c.performanceScore,
        fraudScore: c.fraudScore,
        suggestedRateCents: this.estimateRate(c.followersCount, c.engagementRate, 'creator'),
        estimatedReach: perf?.predictedReach ?? c.followersCount,
        estimatedRoi: perf?.predictedROI,
        reasoning: `${c.niche.join(', ')} creator with ${c.followersCount.toLocaleString()} followers (${(c.engagementRate * 100).toFixed(1)}% engagement). Audience authenticity: ${c.audienceScore}/100.`,
        aiFlags: c.fraudScore > 40 ? { warning: 'Elevated fraud score — review before contracting' } : undefined,
      };
    });
  }

  private async scoreAthletes(athletes: Array<{
    id: string;
    sport: string;
    performanceScore: number;
    audienceScore: number;
    fraudScore: number;
    followersCount: number;
    engagementRate: number;
    fmvMinCents: number | null;
    fmvMaxCents: number | null;
    marketplaceListing: { minDealValueCents: number } | null;
  }>, brief: string) {
    return athletes.map((a) => {
      const matchScore = Math.round(
        (a.performanceScore * 0.4) +
        (a.audienceScore * 0.3) +
        ((100 - a.fraudScore) * 0.3),
      );

      return {
        creatorId: undefined as string | undefined,
        athleteId: a.id,
        matchScore,
        audienceAlignScore: a.audienceScore,
        performanceScore: a.performanceScore,
        fraudScore: a.fraudScore,
        suggestedRateCents: a.fmvMinCents ?? this.estimateRate(a.followersCount, a.engagementRate, 'athlete'),
        estimatedReach: a.followersCount,
        estimatedRoi: undefined,
        reasoning: `${a.sport} athlete with ${a.followersCount.toLocaleString()} followers. AI-assessed FMV: $${((a.fmvMinCents ?? 0) / 100).toLocaleString()}–$${((a.fmvMaxCents ?? 0) / 100).toLocaleString()}.`,
        aiFlags: undefined,
      };
    });
  }

  /** Simple rate estimation when no AI assessment is available */
  private estimateRate(followers: number, engagementRate: number, type: 'creator' | 'athlete'): number {
    // CPM-based: $5-15 CPM × estimated reach
    const estimatedReach = followers * engagementRate;
    const cpm = type === 'athlete' ? 12 : 8;
    return Math.round((estimatedReach / 1000) * cpm * 100); // cents
  }
}
