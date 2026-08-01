import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type EmbeddingType = 'profile' | 'graph' | 'clause' | 'style';
export type EmbeddingModel = 'text-embedding-3-small' | 'node2vec-v1';

const EMBEDDING_DIMENSIONS: Record<EmbeddingModel, number> = {
  'text-embedding-3-small': 1536,
  'node2vec-v1': 128,
};

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly openaiApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiApiKey = config.get<string>('ai.openaiApiKey') ?? '';
  }

  // ── OpenAI embedding call ─────────────────────────────────────────────────

  async embed(text: string, model: EmbeddingModel = 'text-embedding-3-small'): Promise<number[]> {
    if (!this.openaiApiKey) {
      this.logger.warn('OpenAI API key not set — returning zero vector');
      return new Array(EMBEDDING_DIMENSIONS[model]).fill(0) as number[];
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: text.slice(0, 8000) }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI embedding error: ${err}`);
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  // ── Persist embedding ─────────────────────────────────────────────────────

  async storeEmbedding(
    entityType: string,
    entityId: string,
    embeddingType: EmbeddingType,
    vector: number[],
    model: EmbeddingModel = 'text-embedding-3-small',
    creatorId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.embeddingRecord.upsert({
      where: {
        entityType_entityId_embeddingType_model: {
          entityType,
          entityId,
          embeddingType,
          model,
        },
      },
      create: {
        entityType,
        entityId,
        embeddingType,
        model,
        dimensions: vector.length,
        vector,
        creatorId: creatorId ?? null,
        metadata: metadata !== undefined && metadata !== null ? (metadata as import('@prisma/client').Prisma.InputJsonValue) : undefined,
      },
      update: {
        vector,
        dimensions: vector.length,
        metadata: metadata !== undefined && metadata !== null ? (metadata as import('@prisma/client').Prisma.InputJsonValue) : undefined,
      },
    });
  }

  // ── Embed + store creator profile ─────────────────────────────────────────

  async embedCreatorProfile(creatorId: string): Promise<void> {
    const creator = await this.prisma.creator.findUniqueOrThrow({
      where: { id: creatorId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const text = [
      `${creator.user.firstName} ${creator.user.lastName}`,
      creator.handle,
      creator.bio ?? '',
      creator.niche.join(', '),
      creator.contentStyle.join(', '),
      creator.aestheticTags.join(', '),
      [creator.city, creator.region, creator.country].filter(Boolean).join(', '),
      creator.primaryPlatform ?? '',
    ]
      .filter(Boolean)
      .join('. ');

    const vector = await this.embed(text);
    await this.storeEmbedding('creator', creatorId, 'profile', vector, 'text-embedding-3-small', creatorId);
    this.logger.log(`Profile embedding stored for creator=${creatorId}`);
  }

  // ── Embed + store athlete profile ─────────────────────────────────────────

  async embedAthleteProfile(athleteId: string): Promise<void> {
    const athlete = await this.prisma.athlete.findUniqueOrThrow({
      where: { id: athleteId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const text = [
      `${athlete.user.firstName} ${athlete.user.lastName}`,
      athlete.sport,
      athlete.position ?? '',
      athlete.contentStyle.join(', '),
      athlete.aestheticTags.join(', '),
      [athlete.city, athlete.region, athlete.country].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join('. ');

    const vector = await this.embed(text);
    await this.storeEmbedding('athlete', athleteId, 'profile', vector);
    this.logger.log(`Profile embedding stored for athlete=${athleteId}`);
  }

  // ── Embed + store contract clause ─────────────────────────────────────────

  async embedContractClause(clauseId: string, content: string, contractId: string): Promise<void> {
    const vector = await this.embed(content);
    await this.storeEmbedding(
      'clause',
      clauseId,
      'clause',
      vector,
      'text-embedding-3-small',
      undefined,
      { contractId },
    );
  }

  // ── Cosine similarity search (host-side, no pgvector for now) ────────────

  async findSimilarCreators(
    queryVector: number[],
    limit = 10,
  ): Promise<Array<{ creatorId: string; score: number }>> {
    const records = await this.prisma.embeddingRecord.findMany({
      where: { entityType: 'creator', embeddingType: 'profile' },
      select: { entityId: true, vector: true },
    });

    return records
      .map((r) => ({
        creatorId: r.entityId,
        score: this.cosineSimilarity(queryVector, r.vector as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
  }
}
