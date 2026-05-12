import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as crypto from 'crypto';
import { QUEUE_NAMES } from '../queue.module';
import { PrismaService } from '../../prisma/prisma.service';

export interface WebhookDeliveryJobData {
  endpointId: string;
  deliveryId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.WEBHOOK_DELIVERY)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const { deliveryId, url, secret, event, payload } = job.data;
    this.logger.log(`Delivering webhook ${deliveryId} to ${url}`);

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const sig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    let responseStatus: number | null = null;
    let responseBody: string | null = null;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Conic-Signature': `sha256=${sig}`,
          'X-Conic-Event': event,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      responseStatus = res.status;
      responseBody = await res.text();

      if (!res.ok) {
        throw new Error(`Webhook endpoint responded with ${res.status}`);
      }

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          responseStatus,
          responseBody: responseBody.slice(0, 1000),
          attempts: { increment: 1 },
          succeededAt: new Date(),
        },
      });

      this.logger.log(`Webhook ${deliveryId} delivered successfully (${responseStatus})`);
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          responseStatus,
          responseBody: String(error).slice(0, 1000),
          attempts: { increment: 1 },
          failedAt: new Date(),
        },
      });
      this.logger.warn(`Webhook ${deliveryId} failed: ${error}`);
      throw error; // BullMQ will retry per job options
    }
  }
}
