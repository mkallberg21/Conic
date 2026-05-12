import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, TTL } from '../../common/cache/cache.service';

// ─── Remote API shapes ────────────────────────────────────────────────────────

interface ClusterResult {
  creator_id: string;
  cluster_id: number;
  cluster_label: string;
}

interface GraphStatsResponse {
  nodes: number;
  edges: number;
  top_influencers: Array<{ creatorId: string; centrality: number }>;
  density: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('ai.creatorGraphUrl', 'http://localhost:8003');
  }

  // ── Node upsert ────────────────────────────────────────────────────────────

  /**
   * Ensures the creator has a GraphNode record with current metrics.
   * Calls creator-graph-ai to register the node, then derives degree centrality
   * locally from stored edges and persists back.
   */
  async upsertNode(creatorId: string): Promise<void> {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        followersCount: true,
        engagementRate: true,
        niche: true,
        primaryPlatform: true,
        isVerified: true,
      },
    });
    if (!creator) return;

    // Register node in in-memory graph service (best-effort)
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/graph/nodes`, {
          creator_id: creatorId,
          metadata: {
            followers_count: creator.followersCount,
            engagement_rate: creator.engagementRate,
            niche: creator.niche,
            platform: creator.primaryPlatform,
          },
        }),
      );
    } catch (err) {
      this.logger.warn(`creator-graph-ai /graph/nodes failed: ${(err as Error).message}`);
    }

    // Compute local metrics from DB edges
    const [outgoing, incoming] = await Promise.all([
      this.prisma.creatorGraphEdge.count({ where: { source: { creatorId } } }),
      this.prisma.creatorGraphEdge.count({ where: { target: { creatorId } } }),
    ]);
    const degree = outgoing + incoming;

    // Total node count for normalised centrality
    const nodeCount = await this.prisma.creatorGraphNode.count();
    const centrality = nodeCount > 1 ? degree / (nodeCount - 1) : 0;

    // Influence score: weighted follower × engagement × verification
    const influenceScore = Math.min(
      1,
      ((creator.followersCount / 1_000_000) * 0.4 +
        (creator.engagementRate / 10) * 0.4 +
        (creator.isVerified ? 0.2 : 0)) as number,
    );

    // Trending score: recency-weighted engagement (simple heuristic — can be replaced)
    const recentDeliverables = await this.prisma.deliverable.count({
      where: {
        creatorId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        status: 'APPROVED',
      },
    });
    const trendingScore = Math.min(1, recentDeliverables * 0.1 + influenceScore * 0.5);

    await this.prisma.creatorGraphNode.upsert({
      where: { creatorId },
      create: { creatorId, centrality, influenceScore, trendingScore, lastAnalyzedAt: new Date() },
      update: { centrality, influenceScore, trendingScore, lastAnalyzedAt: new Date() },
    });

    await this.cache.del(CacheService.keys.graphNode(creatorId));
    this.logger.debug(`Graph node updated for creator=${creatorId} centrality=${centrality.toFixed(4)}`);
  }

  // ── Audience overlap edges ─────────────────────────────────────────────────

  /**
   * Builds or refreshes edges for a creator based on niche similarity.
   * Two creators are linked with weight = shared niches / total unique niches.
   */
  async buildNicheEdges(creatorId: string, maxNeighbours = 20): Promise<void> {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: { niche: true, primaryPlatform: true },
    });
    if (!creator || creator.niche.length === 0) return;

    const node = await this.prisma.creatorGraphNode.findUnique({ where: { creatorId } });
    if (!node) return;

    // Find creators sharing at least one niche on same platform
    const candidates = await this.prisma.creator.findMany({
      where: {
        id: { not: creatorId },
        primaryPlatform: creator.primaryPlatform ?? undefined,
        niche: { hasSome: creator.niche },
      },
      select: { id: true, niche: true },
      take: maxNeighbours,
    });

    for (const candidate of candidates) {
      const candidateNode = await this.prisma.creatorGraphNode.findUnique({
        where: { creatorId: candidate.id },
        select: { id: true },
      });
      if (!candidateNode) continue;

      const shared = candidate.niche.filter((n) => creator.niche.includes(n)).length;
      const union = new Set([...creator.niche, ...candidate.niche]).size;
      const weight = union > 0 ? shared / union : 0;
      if (weight < 0.1) continue;

      await this.prisma.creatorGraphEdge.upsert({
        where: {
          sourceId_targetId: { sourceId: node.id, targetId: candidateNode.id },
        },
        create: {
          sourceId: node.id,
          targetId: candidateNode.id,
          weight,
          edgeType: 'niche_similar',
        },
        update: { weight },
      });

      // Register edge in in-memory service (best-effort)
      try {
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/graph/edges`, {
            source_id: creatorId,
            target_id: candidate.id,
            weight,
            edge_type: 'niche_similar',
          }),
        );
      } catch {
        // non-fatal
      }
    }

    this.logger.debug(`Built niche edges for creator=${creatorId} candidates=${candidates.length}`);
  }

  // ── Cluster assignment ─────────────────────────────────────────────────────

  /**
   * Calls creator-graph-ai /clusters to assign k-means clusters to a batch.
   * Updates creatorGraphNode.clusterId + clusterLabel for each.
   */
  async recomputeClusters(limit = 500): Promise<void> {
    const creators = await this.prisma.creator.findMany({
      take: limit,
      select: { id: true, followersCount: true, engagementRate: true, niche: true },
      orderBy: { performanceScore: 'desc' },
    });
    if (creators.length === 0) return;

    const payload = creators.map((c) => ({
      id: c.id,
      followers_count: c.followersCount,
      engagement_rate: c.engagementRate,
      niche_vector: c.niche,
    }));

    let results: ClusterResult[] = [];
    try {
      const resp = await firstValueFrom(
        this.http.post<ClusterResult[]>(`${this.baseUrl}/clusters`, {
          creators: payload,
          n_clusters: Math.min(6, creators.length),
        }),
      );
      results = resp.data;
    } catch (err) {
      this.logger.warn(`creator-graph-ai /clusters failed: ${(err as Error).message}`);
      return;
    }

    // Batch upsert cluster assignments
    await Promise.all(
      results.map((r) =>
        this.prisma.creatorGraphNode.upsert({
          where: { creatorId: r.creator_id },
          create: {
            creatorId: r.creator_id,
            clusterId: String(r.cluster_id),
            clusterLabel: r.cluster_label,
          },
          update: {
            clusterId: String(r.cluster_id),
            clusterLabel: r.cluster_label,
          },
        }).catch(() => {
          // Skip if creator has no graph node yet
        }),
      ),
    );

    this.logger.log(`Cluster assignment complete for ${results.length} creators`);
  }

  // ── Network view for API ───────────────────────────────────────────────────

  async getNetwork(creatorId: string, depth = 1) {
    const cacheKey = CacheService.keys.graphNode(creatorId);

    return this.cache.wrap(
      cacheKey,
      async () => {
        const [nodeBase, outEdges, inEdges] = await Promise.all([
          this.prisma.creatorGraphNode.findUnique({ where: { creatorId } }),
          this.prisma.creatorGraphEdge.findMany({
            where: { source: { creatorId } },
            take: 50,
            include: {
              target: {
                include: { creator: { select: { id: true, handle: true, followersCount: true } } },
              },
            },
          }),
          this.prisma.creatorGraphEdge.findMany({
            where: { target: { creatorId } },
            take: 50,
            include: {
              source: {
                include: { creator: { select: { id: true, handle: true, followersCount: true } } },
              },
            },
          }),
        ]);
        if (!nodeBase) return null;

        const neighbours = [
          ...outEdges.map((e) => ({ ...e.target.creator, edgeType: e.edgeType, weight: e.weight, direction: 'out' as const })),
          ...inEdges.map((e) => ({ ...e.source.creator, edgeType: e.edgeType, weight: e.weight, direction: 'in' as const })),
        ];

        return {
          node: {
            creatorId,
            clusterId: nodeBase.clusterId,
            clusterLabel: nodeBase.clusterLabel,
            centrality: nodeBase.centrality,
            influenceScore: nodeBase.influenceScore,
            trendingScore: nodeBase.trendingScore,
            trending: nodeBase.trending,
          },
          neighbours,
          depth,
        };
      },
      TTL.MEDIUM,
    );
  }

  // ── Global graph stats (proxied from creator-graph-ai) ────────────────────

  async getStats(): Promise<GraphStatsResponse | null> {
    try {
      const resp = await firstValueFrom(
        this.http.get<GraphStatsResponse>(`${this.baseUrl}/graph/stats`),
      );
      return resp.data;
    } catch (err) {
      this.logger.warn(`creator-graph-ai /graph/stats failed: ${(err as Error).message}`);
      return null;
    }
  }
}
