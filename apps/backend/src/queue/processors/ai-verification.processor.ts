import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { AiService } from '../../modules/ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface AiVerificationJobData {
  deliverableId: string;
  proofUrl: string;
  platform: string;
  contentType: string;
  requiredHashtags: string[];
  requiredMentions: string[];
  caption?: string;
}

@Processor(QUEUE_NAMES.AI_VERIFICATION)
export class AiVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiVerificationProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<AiVerificationJobData>): Promise<void> {
    const { deliverableId, ...verifyInput } = job.data;
    this.logger.log(`Verifying deliverable ${deliverableId} (attempt ${job.attemptsMade + 1})`);

    await this.aiService.verifyDeliverable(deliverableId, verifyInput);

    // Write AIRequest log
    await this.prisma.aIRequest.create({
      data: {
        modelType: 'deliverable_verify',
        inputPayload: verifyInput,
        status: 'success',
        resourceType: 'Deliverable',
        resourceId: deliverableId,
      },
    });

    this.logger.log(`Deliverable ${deliverableId} verified successfully`);
  }
}
