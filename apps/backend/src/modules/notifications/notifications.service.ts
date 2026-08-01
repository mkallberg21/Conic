import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENTS } from '../../events/event-bus.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(EVENTS.CONTRACT_CREATED)
  async onContractCreated(payload: { contractId: string; brandId: string; creatorId: string }) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: payload.contractId },
      include: { creator: { include: { user: true } } },
    });
    if (!contract) return;

    await this.prisma.notification.create({
      data: {
        recipientId: contract.creator.userId,
        type: 'CONTRACT_CREATED',
        title: 'New contract received',
        body: `You have a new contract: "${contract.title}". Review and sign.`,
        data: { contractId: payload.contractId },
      },
    });

    // Minor creator → also notify their guardians so a parent sees the agreement.
    if (contract.creator.isMinor) {
      await this.notifyGuardiansOfCreator(contract.creator.id, {
        type: 'GUARDIAN_CONTRACT_CREATED',
        title: 'A new agreement needs your approval',
        body: `A new contract "${contract.title}" was sent to your minor. Review and approve it.`,
        data: { contractId: payload.contractId, kind: 'contract_approval' },
      });
    }
  }

  /** Fan a notification out to every guardian linked to a (minor) creator. */
  private async notifyGuardiansOfCreator(
    creatorId: string,
    notification: { type: string; title: string; body: string; data: Prisma.InputJsonValue },
  ) {
    const relationships = await this.prisma.guardianRelationship.findMany({
      where: { creatorId },
      select: { guardian: { select: { userId: true } } },
    });
    if (relationships.length === 0) return;
    await this.prisma.notification.createMany({
      data: relationships.map((rel) => ({
        recipientId: rel.guardian.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      })),
    });
  }

  @OnEvent(EVENTS.DELIVERABLE_SUBMITTED)
  async onDeliverableSubmitted(payload: { deliverableId: string; contractId: string }) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: payload.deliverableId },
      include: { contract: { include: { brand: { include: { user: true } } } } },
    });
    if (!deliverable) return;

    await this.prisma.notification.create({
      data: {
        recipientId: deliverable.contract.brand.userId,
        type: 'DELIVERABLE_SUBMITTED',
        title: 'Deliverable submitted for review',
        body: `"${deliverable.title}" has been submitted. Review and approve.`,
        data: { deliverableId: payload.deliverableId },
      },
    });
  }

  @OnEvent(EVENTS.PAYMENT_RELEASED)
  async onPaymentReleased(payload: { paymentId: string; amount: number; creatorId: string }) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: payload.creatorId },
    });
    if (!creator) return;

    await this.prisma.notification.create({
      data: {
        recipientId: creator.userId,
        type: 'PAYMENT_RELEASED',
        title: 'Payment received',
        body: `A payment of $${(payload.amount / 100).toFixed(2)} has been released to your account.`,
        data: { paymentId: payload.paymentId },
      },
    });
  }

  @OnEvent(EVENTS.DELIVERABLE_APPROVED)
  async onDeliverableApproved(payload: { deliverableId: string; contractId: string }) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: payload.deliverableId },
      select: { title: true, creatorId: true, creator: { select: { userId: true } } },
    });
    if (!deliverable) return;

    await this.prisma.notification.create({
      data: {
        recipientId: deliverable.creator.userId,
        type: 'DELIVERABLE_APPROVED',
        title: 'Deliverable approved',
        body: `"${deliverable.title}" has been approved. Payment will be released shortly.`,
        data: { deliverableId: payload.deliverableId, contractId: payload.contractId },
      },
    });
  }

  @OnEvent(EVENTS.DELIVERABLE_REJECTED)
  async onDeliverableRejected(payload: { deliverableId: string; contractId: string }) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: payload.deliverableId },
      select: { title: true, rejectionReason: true, creator: { select: { userId: true } } },
    });
    if (!deliverable) return;

    await this.prisma.notification.create({
      data: {
        recipientId: deliverable.creator.userId,
        type: 'DELIVERABLE_REJECTED',
        title: 'Deliverable needs revision',
        body: deliverable.rejectionReason
          ? `"${deliverable.title}" was rejected: ${deliverable.rejectionReason}`
          : `"${deliverable.title}" was rejected. Please review the feedback and resubmit.`,
        data: { deliverableId: payload.deliverableId, contractId: payload.contractId },
      },
    });
  }

  async findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }
}
