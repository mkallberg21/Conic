import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingsService } from '../../modules/embeddings/embeddings.service';
import { CacheService } from '../../common/cache/cache.service';

export interface EmbeddingJobData {
  entityType: 'creator' | 'clause';
  entityId: string;
  text?: string;       // for clause embeddings
  creatorId?: string;  // for creator embeddings
}

@Processor(QUEUE_NAMES.EMBEDDING)
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly cache: CacheService,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    const { entityType, entityId, text, creatorId } = job.data;
    this.logger.log(`Generating embedding for ${entityType}:${entityId}`);

    try {
      if (entityType === 'creator') {
        await this.embeddings.embedCreatorProfile(entityId);
        await this.cache.del(CacheService.keys.creator(entityId));
      } else if (entityType === 'clause' && text) {
        await this.embeddings.embedContractClause(entityId, text, creatorId ?? entityId);
      }
    } catch (err) {
      this.logger.error(`Embedding job failed for ${entityType}:${entityId} — ${(err as Error).message}`);
      throw err;
    }
  }
}
