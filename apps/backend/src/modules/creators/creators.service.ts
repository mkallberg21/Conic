import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, TTL } from '../../common/cache/cache.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { QUEUE_NAMES } from '../../queue/queue.module';

export interface DiscoveryFilters {
  q?: string;                  // full-text search on handle, bio, niche
  niche?: string;
  platform?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  maxEngagement?: number;
  minPerformanceScore?: number;
  maxFraudScore?: number;      // upper bound — lower is better
  pricingTier?: string;
  isVerified?: boolean;
  trending?: boolean;
  page?: number;
  take?: number;
}

@Injectable()
export class CreatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @InjectQueue(QUEUE_NAMES.CREATOR_SCORING) private readonly scoringQueue: Queue,
  ) {}

  async findAll(filters?: { niche?: string; platform?: string; minFollowers?: number }) {
    return this.discover({ ...filters, take: 50 });
  }

  async discover(filters: DiscoveryFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const take = Math.min(filters.take ?? 24, 100);
    const skip = (page - 1) * take;

    // Cache key based on filter hash
    const filterHash = createHash('sha1').update(JSON.stringify({ ...filters, page, take })).digest('hex').slice(0, 16);
    const cacheKey = CacheService.keys.creatorDiscover(filterHash);

    return this.cache.wrap(
      cacheKey,
      async () => {
        const where: Record<string, unknown> = {};

    // Text search across handle, bio, niche
    if (filters.q) {
      where.OR = [
        { handle: { contains: filters.q, mode: 'insensitive' } },
        { bio: { contains: filters.q, mode: 'insensitive' } },
        { niche: { has: filters.q.toLowerCase() } },
      ];
    }

    if (filters.niche) where.niche = { has: filters.niche };
    if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;
    if (filters.pricingTier) where.pricingTier = filters.pricingTier;

    if (filters.minFollowers !== undefined || filters.maxFollowers !== undefined) {
      where.followersCount = {
        ...(filters.minFollowers !== undefined ? { gte: Number(filters.minFollowers) } : {}),
        ...(filters.maxFollowers !== undefined ? { lte: Number(filters.maxFollowers) } : {}),
      };
    }

    if (filters.minEngagement !== undefined || filters.maxEngagement !== undefined) {
      where.engagementRate = {
        ...(filters.minEngagement !== undefined ? { gte: Number(filters.minEngagement) } : {}),
        ...(filters.maxEngagement !== undefined ? { lte: Number(filters.maxEngagement) } : {}),
      };
    }

    if (filters.minPerformanceScore !== undefined) {
      where.performanceScore = { gte: Number(filters.minPerformanceScore) };
    }

    if (filters.maxFraudScore !== undefined) {
      where.fraudScore = { lte: Number(filters.maxFraudScore) };
    }

    if (filters.trending) {
      where.graphNode = { is: { trending: true } };
    }

    if (filters.platform) {
      // Platform stored as JSON { instagram: "handle", ... }
      // Filter: primaryPlatform OR JSON key presence
      where.OR = [
        ...(where.OR as unknown[] ?? []),
        { primaryPlatform: { equals: filters.platform } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.creator.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          graphNode: { select: { influenceScore: true, trending: true, trendingScore: true, clusterId: true, clusterLabel: true } },
          predictions: { orderBy: { createdAt: 'desc' }, take: 1, select: { predictedROI: true, predictedReach: true, confidence: true, createdAt: true } },
          _count: { select: { contracts: true, deliverables: true } },
        },
        orderBy: { performanceScore: 'desc' },
        skip,
        take,
      }),
      this.prisma.creator.count({ where }),
    ]);

    return {
        items,
        total,
        page,
        take,
        totalPages: Math.ceil(total / take),
      };
    },
    TTL.SHORT,
    );
  }

  async findById(id: string) {
    return this.cache.wrap(
      CacheService.keys.creator(id),
      async () => {
        const creator = await this.prisma.creator.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
            graphNode: true,
            predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
            _count: { select: { contracts: true, deliverables: true } },
          },
        });
        if (!creator) throw new NotFoundException('Creator not found');
        return creator;
      },
      TTL.MEDIUM,
    );
  }

  async findByUserId(userId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        graphNode: true,
        predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { contracts: true, deliverables: true } },
      },
    });
    if (!creator) throw new NotFoundException('Creator profile not found');
    return creator;
  }

  async update(userId: string, dto: Partial<CreateCreatorDto>) {
    const creator = await this.prisma.creator.findUnique({ where: { userId } });
    if (!creator) throw new NotFoundException('Creator profile not found');

    const updated = await this.prisma.creator.update({
      where: { userId },
      data: {
        ...dto,
        platforms: dto.platforms ?? undefined,
      },
    });

    await this.cache.del(
      CacheService.keys.creator(creator.id),
      CacheService.keys.creatorStats(creator.id),
    );
    await this.cache.delPattern('creator:discover:*');
    return updated;
  }

  async updateScores(
    creatorId: string,
    scores: {
      audienceScore?: number;
      fraudScore?: number;
      performanceScore?: number;
    },
  ) {
    return this.prisma.creator.update({
      where: { id: creatorId },
      data: scores,
    });
  }

  async getDashboardStats(creatorId: string) {
    const [deliverables, payments, contracts] = await Promise.all([
      this.prisma.deliverable.groupBy({
        by: ['status'],
        where: { creatorId },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: {
          contract: { creatorId },
          status: 'COMPLETED',
        },
        _sum: { netAmount: true },
      }),
      this.prisma.contract.count({ where: { creatorId, status: 'ACTIVE' } }),
    ]);

    return {
      deliverablesByStatus: deliverables,
      totalEarned: payments._sum.netAmount ?? 0,
      activeContracts: contracts,
    };
  }

  /** Enqueue a background AI scoring job for a creator. */
  async enqueueScoring(creatorId: string): Promise<void> {
    await this.scoringQueue.add(
      'score-creator',
      { creatorId },
      { jobId: `score-${creatorId}-${Date.now()}` },
    );
  }

  /** Alias used by tests and controllers */
  async scheduleScoring(creatorId: string): Promise<void> {
    await this.scoringQueue.add(
      'score',
      { creatorId },
      { jobId: `score-${creatorId}`, delay: 500 },
    );
  }

  /** Upsert creator rate card (cents per content type). */
  async updateRateCard(userId: string, rateCard: Record<string, number>) {
    const creator = await this.prisma.creator.findUnique({ where: { userId } });
    if (!creator) throw new NotFoundException('Creator profile not found');

    return this.prisma.creator.update({
      where: { userId },
      data: { rateCardJson: rateCard },
      select: { id: true, handle: true, rateCardJson: true, pricingTier: true },
    });
  }

  /** Get a creator's rate card with AI-suggested fair-market pricing. */
  async getRateCard(id: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id },
      select: { id: true, handle: true, rateCardJson: true, pricingTier: true, followersCount: true, engagementRate: true, primaryPlatform: true },
    });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator;
  }

  /** Return a summary suitable for graph/embed operations. */
  async getEmbeddingSummary(creatorId: string) {
    return this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        id: true, handle: true, niche: true, primaryPlatform: true,
        followersCount: true, engagementRate: true, performanceScore: true,
        graphNode: { select: { embeddingVector: true, clusterId: true, influenceScore: true } },
      },
    });
  }
}

