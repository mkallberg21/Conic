import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type FeatureSet = 'scoring' | 'pricing' | 'fraud' | 'engagement' | 'graph';

export interface CreatorFeatures extends Record<string, unknown> {
  followersCount: number;
  engagementRate: number;
  avgReach: number;
  audienceScore: number;
  fraudScore: number;
  performanceScore: number;
  totalEarnings: number;
  contractCount: number;
  deliverableApprovalRate: number;
  avgDeliverableDays: number;
  pricingTier: string | null;
  isVerified: boolean;
  influenceScore: number;
  centrality: number;
  clusterId: string | null;
  trendingScore: number;
  platformCount: number;
  nicheCount: number;
}

@Injectable()
export class FeatureStoreService {
  private readonly logger = new Logger(FeatureStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Write ─────────────────────────────────────────────────────────────────

  async upsertFeatures(
    entityType: string,
    entityId: string,
    featureSet: FeatureSet,
    features: Record<string, unknown>,
    creatorId?: string,
    version = 1,
  ): Promise<void> {
    await this.prisma.featureVector.upsert({
      where: { id: `${entityType}:${entityId}:${featureSet}` },
      create: {
        id: `${entityType}:${entityId}:${featureSet}`,
        entityType,
        entityId,
        featureSet,
        version,
        features: features as Prisma.InputJsonValue,
        creatorId: creatorId ?? null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
      update: {
        features: features as Prisma.InputJsonValue,
        version,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getFeatures(
    entityType: string,
    entityId: string,
    featureSet: FeatureSet,
  ): Promise<Record<string, unknown> | null> {
    const record = await this.prisma.featureVector.findUnique({
      where: { id: `${entityType}:${entityId}:${featureSet}` },
    });

    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    return record.features as Record<string, unknown>;
  }

  async getCreatorFeatures(creatorId: string): Promise<Record<FeatureSet, Record<string, unknown>>> {
    const records = await this.prisma.featureVector.findMany({
      where: { creatorId },
    });

    return records.reduce(
      (acc, r) => {
        acc[r.featureSet as FeatureSet] = r.features as Record<string, unknown>;
        return acc;
      },
      {} as Record<FeatureSet, Record<string, unknown>>,
    );
  }

  // ── Compute & persist creator features ────────────────────────────────────

  async computeAndStoreCreatorFeatures(creatorId: string): Promise<CreatorFeatures> {
    const creator = await this.prisma.creator.findUniqueOrThrow({
      where: { id: creatorId },
      include: {
        graphNode: true,
        deliverables: {
          where: { status: { in: ['APPROVED', 'REJECTED'] } },
          select: {
            status: true,
            submittedAt: true,
            approvedAt: true,
            createdAt: true,
          },
        },
        contracts: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
        predictions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const approved = creator.deliverables.filter((d) => d.status === 'APPROVED').length;
    const total = creator.deliverables.length;
    const approvalRate = total > 0 ? approved / total : 0;

    const avgDays =
      creator.deliverables
        .filter((d) => d.approvedAt && d.submittedAt)
        .reduce((sum, d) => {
          const days =
            (d.approvedAt!.getTime() - d.submittedAt!.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / Math.max(approved, 1);

    const platformCount = Object.keys((creator.platforms as Record<string, string>) ?? {}).length;

    const features: CreatorFeatures = {
      followersCount: creator.followersCount,
      engagementRate: creator.engagementRate,
      avgReach: creator.avgReach,
      audienceScore: creator.audienceScore,
      fraudScore: creator.fraudScore,
      performanceScore: creator.performanceScore,
      totalEarnings: creator.totalEarnings,
      contractCount: creator.contracts.length,
      deliverableApprovalRate: approvalRate,
      avgDeliverableDays: avgDays,
      pricingTier: creator.pricingTier,
      isVerified: creator.isVerified,
      influenceScore: creator.graphNode?.influenceScore ?? 0,
      centrality: creator.graphNode?.centrality ?? 0,
      clusterId: creator.graphNode?.clusterId ?? null,
      trendingScore: creator.graphNode?.trendingScore ?? 0,
      platformCount,
      nicheCount: creator.niche.length,
    };

    // Persist all relevant feature sets
    await Promise.all([
      this.upsertFeatures('creator', creatorId, 'scoring', features, creatorId),
      this.upsertFeatures('creator', creatorId, 'pricing', {
        followersCount: features.followersCount,
        engagementRate: features.engagementRate,
        avgReach: features.avgReach,
        pricingTier: features.pricingTier,
        platformCount: features.platformCount,
        nicheCount: features.nicheCount,
        isVerified: features.isVerified,
      } as Record<string, unknown>, creatorId),
      this.upsertFeatures('creator', creatorId, 'fraud', {
        fraudScore: features.fraudScore,
        audienceScore: features.audienceScore,
        engagementRate: features.engagementRate,
        followersCount: features.followersCount,
        deliverableApprovalRate: features.deliverableApprovalRate,
      } as Record<string, unknown>, creatorId),
      this.upsertFeatures('creator', creatorId, 'graph', {
        influenceScore: features.influenceScore,
        centrality: features.centrality,
        trendingScore: features.trendingScore,
        clusterId: features.clusterId,
      } as Record<string, unknown>, creatorId),
    ]);

    this.logger.log(`Features computed for creator=${creatorId}`);
    return features;
  }

  // ── Batch read for training data export ───────────────────────────────────

  async fetchTrainingBatch(featureSet: FeatureSet, limit = 10_000) {
    return this.prisma.featureVector.findMany({
      where: { featureSet, expiresAt: { gt: new Date() } },
      orderBy: { computedAt: 'desc' },
      take: limit,
      select: { entityId: true, features: true, computedAt: true },
    });
  }
}
