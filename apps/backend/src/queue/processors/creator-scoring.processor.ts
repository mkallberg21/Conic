import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { QUEUE_NAMES } from '../queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { FeatureStoreService } from '../../modules/feature-store/feature-store.service';

export interface CreatorScoringJobData {
  creatorId: string;
}

interface PredictionResponse {
  predictedReach: number;
  predictedEngagement: number;
  predictedROI: number;
  audienceAuthenticity: number;
  fraudLikelihood: number;
  confidence: number;
  modelVersion: string;
}

@Processor(QUEUE_NAMES.CREATOR_SCORING)
export class CreatorScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(CreatorScoringProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly featureStore: FeatureStoreService,
  ) {
    super();
  }

  async process(job: Job<CreatorScoringJobData>): Promise<void> {
    const { creatorId } = job.data;
    this.logger.log(`Scoring creator ${creatorId}`);

    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      include: { user: { select: { email: true } } },
    });
    if (!creator) {
      this.logger.warn(`Creator ${creatorId} not found`);
      return;
    }

    const url = this.config.get<string>('ai.performancePredictionUrl');
    if (!url) {
      this.logger.warn('performance-prediction-ai URL not configured');
      return;
    }

    const features = {
      followers_count: creator.followersCount,
      engagement_rate: creator.engagementRate,
      avg_reach: creator.avgReach,
      platform: creator.primaryPlatform ?? 'instagram',
      niche: creator.niche,
    };

    let prediction: PredictionResponse | null = null;
    try {
      const res = await fetch(`${url}/predict/creator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) prediction = (await res.json()) as PredictionResponse;
    } catch (err) {
      this.logger.warn(`Performance prediction failed for ${creatorId}: ${err}`);
    }

    if (prediction) {
      const performanceScore = Math.round(
        ((prediction.audienceAuthenticity * 40) +
         (Math.min(prediction.predictedROI / 5, 1) * 30) +
         (prediction.confidence * 30)),
      );

      await this.prisma.$transaction([
        this.prisma.creator.update({
          where: { id: creatorId },
          data: {
            audienceScore: Math.round(prediction.audienceAuthenticity * 100),
            fraudScore: Math.round(prediction.fraudLikelihood * 100),
            performanceScore: Math.min(100, performanceScore),
          },
        }),
        this.prisma.creatorPrediction.create({
          data: {
            creatorId,
            predictedReach: prediction.predictedReach,
            predictedEngagement: prediction.predictedEngagement,
            predictedROI: prediction.predictedROI,
            audienceAuthenticity: prediction.audienceAuthenticity,
            fraudLikelihood: prediction.fraudLikelihood,
            confidence: prediction.confidence,
            modelVersion: prediction.modelVersion ?? '1.0',
            inputFeatures: features,
          },
        }),
        this.prisma.aIRequest.create({
          data: {
            modelType: 'creator_score',
            inputPayload: features,
            outputPayload: prediction as unknown as Prisma.InputJsonValue,
            status: 'success',
            resourceType: 'Creator',
            resourceId: creatorId,
          },
        }),
      ]);

      this.logger.log(`Creator ${creatorId} scored: performance=${performanceScore}`);

      // Persist scores to feature store for model training
      await this.featureStore.upsertFeatures(
        'creator',
        creatorId,
        'scoring',
        {
          audienceAuthenticity: prediction.audienceAuthenticity,
          fraudLikelihood: prediction.fraudLikelihood,
          predictedROI: prediction.predictedROI,
          predictedReach: prediction.predictedReach,
          confidence: prediction.confidence,
          performanceScore,
        },
        creatorId,
      );
    }
  }
}
