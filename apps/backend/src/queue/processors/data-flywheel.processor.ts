import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { QUEUE_NAMES } from '../queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureStoreService } from '../../modules/feature-store/feature-store.service';
import { EmbeddingsService } from '../../modules/embeddings/embeddings.service';
import { CacheService } from '../../common/cache/cache.service';

export interface DataFlywheelJobData {
  eventType: string;
  sourceEntity: string;
  sourceId: string;
  payload: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.DATA_FLYWHEEL)
export class DataFlywheelProcessor extends WorkerHost {
  private readonly logger = new Logger(DataFlywheelProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureStore: FeatureStoreService,
    private readonly embeddings: EmbeddingsService,
    private readonly cache: CacheService,
  ) {
    super();
  }

  async process(job: Job<DataFlywheelJobData>): Promise<void> {
    const { eventType, sourceEntity, sourceId, payload } = job.data;
    const start = Date.now();
    const featuresFed: string[] = [];

    try {
      this.logger.log(`Flywheel processing event=${eventType} entity=${sourceEntity}:${sourceId}`);

      switch (eventType) {
        case 'contract.signed':
        case 'contract.activated':
          await this.onContractEvent(payload, featuresFed);
          break;

        case 'deliverable.approved':
        case 'deliverable.rejected':
          await this.onDeliverableEvent(payload, featuresFed);
          break;

        case 'payment.completed':
          await this.onPaymentCompleted(payload, featuresFed);
          break;

        case 'creator.score.updated':
          await this.onCreatorScoreUpdated(sourceId, featuresFed);
          break;

        case 'creator.registered':
          await this.onCreatorRegistered(sourceId, featuresFed);
          break;

        default:
          this.logger.debug(`No flywheel handler for event=${eventType}`);
      }

      // Record event in DataFlywheelEvent
      await this.prisma.dataFlywheelEvent.upsert({
        where: { id: `${eventType}:${sourceId}` },
        create: {
          id: `${eventType}:${sourceId}`,
          eventType,
          sourceEntity,
          sourceId,
          payload: payload as Prisma.InputJsonValue,
          processed: true,
          processedAt: new Date(),
          processingMs: Date.now() - start,
          featuresFed,
        },
        update: {
          processed: true,
          processedAt: new Date(),
          processingMs: Date.now() - start,
          featuresFed,
        },
      });

      this.logger.log(
        `Flywheel event=${eventType} processed in ${Date.now() - start}ms, featuresFed=${featuresFed.join(',')}`,
      );
    } catch (err) {
      this.logger.error(`Flywheel event=${eventType} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async onContractEvent(
    payload: Record<string, unknown>,
    featuresFed: string[],
  ): Promise<void> {
    const creatorId = payload['creatorId'] as string | undefined;
    if (!creatorId) return;

    await this.featureStore.computeAndStoreCreatorFeatures(creatorId);
    await this.cache.del(CacheService.keys.creator(creatorId));
    featuresFed.push('scoring', 'pricing');
  }

  private async onDeliverableEvent(
    payload: Record<string, unknown>,
    featuresFed: string[],
  ): Promise<void> {
    const creatorId = payload['creatorId'] as string | undefined;
    if (!creatorId) return;

    await this.featureStore.computeAndStoreCreatorFeatures(creatorId);
    await this.cache.del(CacheService.keys.creator(creatorId), CacheService.keys.creatorStats(creatorId));
    featuresFed.push('scoring', 'fraud');
  }

  private async onPaymentCompleted(
    payload: Record<string, unknown>,
    featuresFed: string[],
  ): Promise<void> {
    const contractId = payload['contractId'] as string | undefined;
    if (!contractId) return;

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { creatorId: true, brandId: true },
    });
    if (!contract) return;

    await this.featureStore.computeAndStoreCreatorFeatures(contract.creatorId);
    await this.cache.del(
      CacheService.keys.creator(contract.creatorId),
      CacheService.keys.analytics('brand', contract.brandId),
    );
    featuresFed.push('scoring', 'pricing', 'fraud');
  }

  private async onCreatorScoreUpdated(creatorId: string, featuresFed: string[]): Promise<void> {
    await this.featureStore.computeAndStoreCreatorFeatures(creatorId);
    await this.embeddings.embedCreatorProfile(creatorId);
    await this.cache.del(
      CacheService.keys.creator(creatorId),
      CacheService.keys.prediction(creatorId),
      CacheService.keys.graphNode(creatorId),
    );
    featuresFed.push('scoring', 'graph', 'engagement');
  }

  private async onCreatorRegistered(creatorId: string, featuresFed: string[]): Promise<void> {
    await this.embeddings.embedCreatorProfile(creatorId);
    featuresFed.push('profile');
  }
}
