import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CalendarEvent {
  id: string;
  type: 'deliverable' | 'payment' | 'appearance' | 'campaign' | 'task' | 'milestone';
  title: string;
  date: Date;
  endDate?: Date;
  status: string;
  entityId: string;
  entityType: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(
    userId: string,
    role: UserRole,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];

    const withinRange = { gte: startDate, lte: endDate };

    if (role === UserRole.CREATOR || role === UserRole.ADMIN || role === UserRole.AGENCY) {
      const creator = await this.prisma.creator.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (creator) {
        // Deliverable due dates
        const deliverables = await this.prisma.deliverable.findMany({
          where: { contract: { creatorId: creator.id }, dueDate: withinRange },
          select: { id: true, title: true, dueDate: true, status: true, contractId: true },
        });
        for (const d of deliverables) {
          events.push({
            id: d.id,
            type: 'deliverable',
            title: d.title,
            date: d.dueDate!,
            status: d.status,
            entityId: d.id,
            entityType: 'Deliverable',
            metadata: { contractId: d.contractId },
          });
        }

        // Payment milestones
        const milestones = await this.prisma.paymentMilestone.findMany({
          where: { contract: { creatorId: creator.id }, dueDate: withinRange },
          select: { id: true, title: true, dueDate: true, amount: true, contractId: true },
        });
        for (const m of milestones) {
          events.push({
            id: m.id,
            type: 'milestone',
            title: m.title,
            date: m.dueDate!,
            status: 'PENDING',
            entityId: m.id,
            entityType: 'PaymentMilestone',
            metadata: { amountCents: m.amount, contractId: m.contractId },
          });
        }

        // Active contracts (timeline)
        const contracts = await this.prisma.contract.findMany({
          where: {
            creatorId: creator.id,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { id: true, title: true, startDate: true, endDate: true, status: true },
        });
        for (const c of contracts) {
          if (c.startDate) {
            events.push({
              id: `contract-start-${c.id}`,
              type: 'campaign',
              title: `${c.title} — Start`,
              date: c.startDate,
              endDate: c.endDate ?? undefined,
              status: c.status,
              entityId: c.id,
              entityType: 'Contract',
            });
          }
        }

        // Campaign tasks assigned to this user
        const tasks = await this.prisma.campaignTask.findMany({
          where: { assigneeId: userId, dueDate: withinRange, completed: false },
          select: { id: true, title: true, dueDate: true, priority: true, campaignId: true, completed: true },
        });
        for (const t of tasks) {
          events.push({
            id: t.id,
            type: 'task',
            title: t.title,
            date: t.dueDate!,
            status: t.completed ? 'COMPLETED' : 'PENDING',
            entityId: t.id,
            entityType: 'CampaignTask',
            metadata: { priority: t.priority, campaignId: t.campaignId },
          });
        }
      }
    }

    if (role === UserRole.ATHLETE || role === UserRole.ADMIN) {
      const athlete = await this.prisma.athlete.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (athlete) {
        // Appearances
        const appearances = await this.prisma.appearance.findMany({
          where: { athleteId: athlete.id, scheduledAt: withinRange },
          select: {
            id: true, title: true, scheduledAt: true, durationMinutes: true,
            status: true, type: true, venueName: true,
          },
        });
        for (const a of appearances) {
          events.push({
            id: a.id,
            type: 'appearance',
            title: a.title,
            date: a.scheduledAt,
            status: a.status,
            entityId: a.id,
            entityType: 'Appearance',
            metadata: { venue: a.venueName, type: a.type, durationMinutes: a.durationMinutes },
          });
        }

        // Payment milestones from NIL deals
        const nilMilestones = await this.prisma.paymentMilestone.findMany({
          where: {
            contract: {
              nilExtension: { isNot: null },
              nilDeals: { some: { athleteId: athlete.id } },
            },
            dueDate: withinRange,
          },
          select: { id: true, title: true, dueDate: true, amount: true, contractId: true },
        });
        for (const m of nilMilestones) {
          events.push({
            id: m.id,
            type: 'milestone',
            title: m.title,
            date: m.dueDate!,
            status: 'PENDING',
            entityId: m.id,
            entityType: 'PaymentMilestone',
            metadata: { amountCents: m.amount },
          });
        }
      }
    }

    if (role === UserRole.BRAND || role === UserRole.AGENCY || role === UserRole.ADMIN) {
      const brand = await this.prisma.brand.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (brand) {
        // Campaigns
        const campaigns = await this.prisma.campaign.findMany({
          where: {
            brandId: brand.id,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { id: true, title: true, startDate: true, endDate: true, status: true },
        });
        for (const c of campaigns) {
          if (c.startDate) {
            events.push({
              id: `campaign-${c.id}`,
              type: 'campaign',
              title: c.title,
              date: c.startDate,
              endDate: c.endDate ?? undefined,
              status: c.status,
              entityId: c.id,
              entityType: 'Campaign',
            });
          }
        }

        // Upcoming payments
        const payments = await this.prisma.payment.findMany({
          where: {
            contract: { brandId: brand.id },
            status: 'PENDING',
            dueDate: withinRange,
          },
          select: { id: true, description: true, dueDate: true, amount: true, contractId: true },
        });
        for (const p of payments) {
          events.push({
            id: p.id,
            type: 'payment',
            title: p.description ?? 'Payment due',
            date: p.dueDate!,
            status: 'PENDING',
            entityId: p.id,
            entityType: 'Payment',
            metadata: { amountCents: p.amount, contractId: p.contractId },
          });
        }
      }
    }

    // Sort by date ascending
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}
