import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../../queue/queue.module';
import { EVENTS } from '../../events/event-bus.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

// Map internal EventBusService event names → webhook event strings
const INTERNAL_TO_WEBHOOK: Record<string, string> = {
  [EVENTS.CONTRACT_CREATED]: 'contract.created',
  [EVENTS.CONTRACT_SIGNED]: 'contract.signed',
  [EVENTS.CONTRACT_ACTIVATED]: 'contract.activated',
  [EVENTS.DELIVERABLE_SUBMITTED]: 'deliverable.submitted',
  [EVENTS.DELIVERABLE_APPROVED]: 'deliverable.approved',
  [EVENTS.PAYMENT_RELEASED]: 'payment.released',
  [EVENTS.PAYMENT_FAILED]: 'payment.failed',
  // NIL events
  [EVENTS.NIL_DISCLOSURE_SUBMITTED]: 'nil.disclosure.submitted',
  [EVENTS.NIL_DISCLOSURE_APPROVED]: 'nil.disclosure.approved',
  [EVENTS.NIL_DISCLOSURE_REJECTED]: 'nil.disclosure.rejected',
  [EVENTS.NIL_DEAL_CREATED]: 'nil.deal.created',
  [EVENTS.NIL_DEAL_ACTIVATED]: 'nil.deal.activated',
  [EVENTS.APPEARANCE_SCHEDULED]: 'nil.appearance.scheduled',
  [EVENTS.APPEARANCE_COMPLETED]: 'nil.appearance.completed',
  [EVENTS.GUARDIAN_APPROVED]: 'nil.guardian.approved',
  [EVENTS.GUARDIAN_REJECTED]: 'nil.guardian.rejected',
  [EVENTS.FMV_ASSESSED]: 'nil.fmv.assessed',
  [EVENTS.ELIGIBILITY_FLAGGED]: 'nil.eligibility.flagged',
  [EVENTS.TAX_DOCUMENT_REQUESTED]: 'tax.document.requested',
  [EVENTS.TAX_DOCUMENT_SUBMITTED]: 'tax.document.submitted',
};

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_DELIVERY)
    private readonly webhookQueue: Queue,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreateWebhookDto) {
    const secret = crypto.randomBytes(32).toString('hex');
    return this.prisma.webhookEndpoint.create({
      data: {
        url: dto.url,
        secret,
        events: dto.events,
        isActive: true,
      },
      select: {
        id: true, url: true, events: true, isActive: true, createdAt: true,
        // Return secret once so caller can store it
        secret: true,
      },
    });
  }

  async findAll() {
    return this.prisma.webhookEndpoint.findMany({
      select: { id: true, url: true, events: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const ep = await this.prisma.webhookEndpoint.findUnique({
      where: { id },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true, event: true, responseStatus: true, attempts: true,
            succeededAt: true, failedAt: true, createdAt: true,
          },
        },
      },
    });
    if (!ep) throw new NotFoundException('Webhook endpoint not found');
    const { secret: _, ...rest } = ep;
    return rest;
  }

  async update(id: string, dto: UpdateWebhookDto) {
    await this.findById(id);
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: dto,
      select: { id: true, url: true, events: true, isActive: true, updatedAt: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    return { deleted: true };
  }

  async rotateSecret(id: string) {
    await this.findById(id);
    const secret = crypto.randomBytes(32).toString('hex');
    await this.prisma.webhookEndpoint.update({ where: { id }, data: { secret } });
    return { secret };
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  /**
   * Called by event listeners. Fans out to all active endpoints subscribed
   * to this event and enqueues a delivery job for each.
   */
  async dispatch(webhookEvent: string, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { isActive: true, events: { has: webhookEvent } },
      select: { id: true, url: true, secret: true },
    });

    for (const ep of endpoints) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          event: webhookEvent,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      await this.webhookQueue.add(
        'deliver',
        {
          endpointId: ep.id,
          deliveryId: delivery.id,
          url: ep.url,
          secret: ep.secret,
          event: webhookEvent,
          payload,
        },
        { jobId: `webhook-${delivery.id}` },
      );
    }
  }

  // ── Event Listeners ───────────────────────────────────────────────────────

  @OnEvent(EVENTS.CONTRACT_CREATED)
  async onContractCreated(payload: Record<string, unknown>) {
    await this.dispatch('contract.created', payload);
  }

  @OnEvent(EVENTS.CONTRACT_SIGNED)
  async onContractSigned(payload: Record<string, unknown>) {
    await this.dispatch('contract.signed', payload);
  }

  @OnEvent(EVENTS.DELIVERABLE_SUBMITTED)
  async onDeliverableSubmitted(payload: Record<string, unknown>) {
    await this.dispatch('deliverable.submitted', payload);
  }

  @OnEvent(EVENTS.DELIVERABLE_APPROVED)
  async onDeliverableApproved(payload: Record<string, unknown>) {
    await this.dispatch('deliverable.approved', payload);
  }

  @OnEvent(EVENTS.PAYMENT_RELEASED)
  async onPaymentReleased(payload: Record<string, unknown>) {
    await this.dispatch('payment.released', payload);
  }

  @OnEvent(EVENTS.PAYMENT_FAILED)
  async onPaymentFailed(payload: Record<string, unknown>) {
    await this.dispatch('payment.failed', payload);
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  async getDeliveryStats(endpointId: string) {
    const [success, failed, pending] = await Promise.all([
      this.prisma.webhookDelivery.count({ where: { endpointId, succeededAt: { not: null } } }),
      this.prisma.webhookDelivery.count({ where: { endpointId, failedAt: { not: null }, succeededAt: null } }),
      this.prisma.webhookDelivery.count({ where: { endpointId, succeededAt: null, failedAt: null } }),
    ]);
    return { success, failed, pending };
  }
}
