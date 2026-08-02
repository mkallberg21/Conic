import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { AnthropicService, ParsedSearch } from '../../common/llm/anthropic.service';
import { DiscoverySearchDto } from './dto/discovery.dto';

const PAGE_SIZE = 12;
const CANDIDATE_POOL = 150; // structured candidates to score semantically

// Weighted blend. Semantic relevance leads; existing quality signals refine.
const W_SEMANTIC = 0.5;
const W_PERFORMANCE = 0.25;
const W_AUDIENCE = 0.15;
const W_FRAUD = 0.1; // applied to (100 - fraudScore)
// Modest placement boost for Pro-subscribed profiles — nudges ranking without
// overriding genuine relevance.
const PRO_BOOST = 4;

export interface DiscoveryResult {
  id: string;
  type: 'creator' | 'athlete';
  displayName: string;
  avatarUrl: string | null;
  headline: string; // niche (creator) or sport (athlete)
  followersCount: number;
  engagementRate: number;
  performanceScore: number;
  audienceScore: number;
  fraudScore: number;
  contentStyle: string[];
  isVerified: boolean;
  matchScore: number; // 0-100
  reason: string;
  // NOTE: contact fields (email, social handles) are intentionally omitted here —
  // brands unlock them only through a deal (see anti-disintermediation).
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly anthropic: AnthropicService,
  ) {}

  async search(dto: DiscoverySearchDto): Promise<{ results: DiscoveryResult[]; page: number; parsed: ParsedSearch }> {
    const page = Math.max(1, dto.page ?? 1);
    const parsed = await this.anthropic.parseSearchQuery(dto.query);
    if (dto.entityType) parsed.entityType = dto.entityType;

    const queryVector = await this.embeddings.embed(parsed.semanticQuery || dto.query);

    const [creators, athletes] = await Promise.all([
      parsed.entityType === 'athlete' ? [] : this.fetchCreators(parsed),
      parsed.entityType === 'creator' ? [] : this.fetchAthletes(parsed),
    ]);

    // Load profile embeddings for the candidate pool in one query.
    const ids = [...creators.map((c) => c.id), ...athletes.map((a) => a.id)];
    const vectors = await this.loadEmbeddings(ids);

    const scored: DiscoveryResult[] = [
      ...creators.map((c) => this.scoreCreator(c, queryVector, vectors.get(c.id))),
      ...athletes.map((a) => this.scoreAthlete(a, queryVector, vectors.get(a.id))),
    ].sort((x, y) => y.matchScore - x.matchScore);

    const start = (page - 1) * PAGE_SIZE;
    const pageResults = scored.slice(start, start + PAGE_SIZE);

    // Explain only the page the caller sees.
    const reasons = await this.anthropic.explainMatches(
      dto.query,
      pageResults.map((r) => ({
        id: r.id,
        summary: `${r.type} • ${r.headline} • ${r.followersCount.toLocaleString()} followers • style: ${r.contentStyle.join(', ') || 'n/a'}`,
      })),
    );
    for (const r of pageResults) r.reason = reasons[r.id] ?? r.reason;

    return { results: pageResults, page, parsed };
  }

  // ── Candidate fetching (structured filters) ─────────────────────────────────

  private fetchCreators(p: ParsedSearch) {
    const where: Prisma.CreatorWhereInput = {
      fraudScore: { lte: 70 },
      ...(p.niche.length ? { niche: { hasSome: p.niche } } : {}),
      ...(p.contentStyle.length ? { contentStyle: { hasSome: p.contentStyle } } : {}),
      ...(p.platforms.length ? { primaryPlatform: { in: p.platforms } } : {}),
      ...(p.minFollowers != null ? { followersCount: { gte: p.minFollowers } } : {}),
      ...(p.maxFollowers != null
        ? { followersCount: { ...(p.minFollowers != null ? { gte: p.minFollowers } : {}), lte: p.maxFollowers } }
        : {}),
      ...(p.minEngagement != null ? { engagementRate: { gte: p.minEngagement } } : {}),
    };
    return this.prisma.creator.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { performanceScore: 'desc' },
      take: CANDIDATE_POOL,
    });
  }

  private fetchAthletes(p: ParsedSearch) {
    const where: Prisma.AthleteWhereInput = {
      nilActive: true,
      fraudScore: { lte: 70 },
      ...(p.sport ? { sport: p.sport } : {}),
      ...(p.contentStyle.length ? { contentStyle: { hasSome: p.contentStyle } } : {}),
      ...(p.minFollowers != null ? { followersCount: { gte: p.minFollowers } } : {}),
      ...(p.maxFollowers != null
        ? { followersCount: { ...(p.minFollowers != null ? { gte: p.minFollowers } : {}), lte: p.maxFollowers } }
        : {}),
      ...(p.minEngagement != null ? { engagementRate: { gte: p.minEngagement } } : {}),
    };
    return this.prisma.athlete.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { performanceScore: 'desc' },
      take: CANDIDATE_POOL,
    });
  }

  private async loadEmbeddings(entityIds: string[]): Promise<Map<string, number[]>> {
    if (entityIds.length === 0) return new Map();
    const records = await this.prisma.embeddingRecord.findMany({
      where: { embeddingType: 'profile', entityId: { in: entityIds } },
      select: { entityId: true, vector: true },
    });
    return new Map(records.map((r) => [r.entityId, r.vector as number[]]));
  }

  // ── Scoring ─────────────────────────────────────────────────────────────────

  private blend(semantic: number, performance: number, audience: number, fraud: number, isPro = false): number {
    const score =
      W_SEMANTIC * (semantic * 100) +
      W_PERFORMANCE * performance +
      W_AUDIENCE * audience +
      W_FRAUD * (100 - fraud) +
      (isPro ? PRO_BOOST : 0);
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private scoreCreator(
    c: { id: string; niche: string[]; contentStyle: string[]; followersCount: number; engagementRate: number;
      performanceScore: number; audienceScore: number; fraudScore: number; isVerified: boolean; isPro: boolean;
      user: { firstName: string; lastName: string; avatarUrl: string | null } },
    queryVector: number[],
    vector?: number[],
  ): DiscoveryResult {
    const semantic = vector ? this.embeddings.similarity(queryVector, vector) : 0;
    return {
      id: c.id, type: 'creator',
      displayName: `${c.user.firstName} ${c.user.lastName}`.trim(),
      avatarUrl: c.user.avatarUrl,
      headline: c.niche.join(', ') || 'Creator',
      followersCount: c.followersCount, engagementRate: c.engagementRate,
      performanceScore: c.performanceScore, audienceScore: c.audienceScore, fraudScore: c.fraudScore,
      contentStyle: c.contentStyle, isVerified: c.isVerified,
      matchScore: this.blend(semantic, c.performanceScore, c.audienceScore, c.fraudScore, c.isPro),
      reason: 'Matches your niche, audience and performance filters.',
    };
  }

  private scoreAthlete(
    a: { id: string; sport: string; contentStyle: string[]; followersCount: number; engagementRate: number;
      performanceScore: number; audienceScore: number; fraudScore: number; isVerified: boolean; isPro: boolean;
      user: { firstName: string; lastName: string; avatarUrl: string | null } },
    queryVector: number[],
    vector?: number[],
  ): DiscoveryResult {
    const semantic = vector ? this.embeddings.similarity(queryVector, vector) : 0;
    return {
      id: a.id, type: 'athlete',
      displayName: `${a.user.firstName} ${a.user.lastName}`.trim(),
      avatarUrl: a.user.avatarUrl,
      headline: a.sport,
      followersCount: a.followersCount, engagementRate: a.engagementRate,
      performanceScore: a.performanceScore, audienceScore: a.audienceScore, fraudScore: a.fraudScore,
      contentStyle: a.contentStyle, isVerified: a.isVerified,
      matchScore: this.blend(semantic, a.performanceScore, a.audienceScore, a.fraudScore, a.isPro),
      reason: 'Matches your sport, audience and performance filters.',
    };
  }
}
