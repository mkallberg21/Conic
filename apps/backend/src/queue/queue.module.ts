import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiVerificationProcessor } from './processors/ai-verification.processor';
import { CreatorScoringProcessor } from './processors/creator-scoring.processor';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor';
import { CampaignSummaryProcessor } from './processors/campaign-summary.processor';
import { DataFlywheelProcessor } from './processors/data-flywheel.processor';
import { EmbeddingProcessor } from './processors/embedding.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../modules/ai/ai.module';
import { FeatureStoreModule } from '../modules/feature-store/feature-store.module';
import { EmbeddingsModule } from '../modules/embeddings/embeddings.module';

export const QUEUE_NAMES = {
  AI_VERIFICATION: 'ai-verification',
  CREATOR_SCORING: 'creator-scoring',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  CAMPAIGN_SUMMARY: 'campaign-summary',
  DATA_FLYWHEEL: 'data-flywheel',
  EMBEDDING: 'embedding',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password'),
          tls: config.get<string>('NODE_ENV') === 'production' ? {} : undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AI_VERIFICATION },
      { name: QUEUE_NAMES.CREATOR_SCORING },
      { name: QUEUE_NAMES.WEBHOOK_DELIVERY },
      { name: QUEUE_NAMES.CAMPAIGN_SUMMARY },
      { name: QUEUE_NAMES.DATA_FLYWHEEL },
      { name: QUEUE_NAMES.EMBEDDING },
    ),
    PrismaModule,
    AiModule,
    FeatureStoreModule,
    EmbeddingsModule,
  ],
  providers: [
    AiVerificationProcessor,
    CreatorScoringProcessor,
    WebhookDeliveryProcessor,
    CampaignSummaryProcessor,
    DataFlywheelProcessor,
    EmbeddingProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
