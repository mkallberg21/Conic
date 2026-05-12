import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditAction =
  // Auth
  | 'USER_REGISTERED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'PASSWORD_RESET_REQUESTED'
  // Contracts
  | 'CONTRACT_CREATED'
  | 'CONTRACT_UPDATED'
  | 'CONTRACT_SIGNED'
  | 'CONTRACT_ACTIVATED'
  | 'CONTRACT_CANCELLED'
  | 'CONTRACT_DISPUTED'
  | 'CONTRACT_DISPUTE_RESOLVED'
  // Deliverables
  | 'DELIVERABLE_CREATED'
  | 'DELIVERABLE_SUBMITTED'
  | 'DELIVERABLE_APPROVED'
  | 'DELIVERABLE_REJECTED'
  | 'DELIVERABLE_REVISION_REQUESTED'
  | 'DELIVERABLE_VERIFIED'
  // Payments
  | 'PAYMENT_CREATED'
  | 'PAYMENT_RELEASED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  // Users/Profiles
  | 'PROFILE_UPDATED'
  | 'CREATOR_ONBOARDED'
  | 'BRAND_ONBOARDED';

export interface AuditParams {
  userId?: string;
  action: AuditAction | string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an immutable audit record. Never throws — failures are silent
   * (audit must not break the main transaction).
   */
  async log(params: AuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId ?? null,
          oldValue: params.oldValue !== undefined ? (params.oldValue as object) : undefined,
          newValue: params.newValue !== undefined ? (params.newValue as object) : undefined,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
          ipAddress: params.ipAddress ?? null,
        },
      });
    } catch {
      // Audit log writes must never break business operations
    }
  }

  /**
   * Fetch the full audit trail for a specific resource, newest-first.
   * Used for contract/deliverable activity feeds.
   */
  async getResourceHistory(
    resource: string,
    resourceId: string,
    limit = 50,
  ) {
    return this.prisma.auditLog.findMany({
      where: { resource, resourceId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Fetch audit logs that span a contract and all its deliverables + payments.
   * Power behind GET /v1/contracts/:id/activity.
   */
  async getContractActivity(contractId: string) {
    const deliverables = await this.prisma.deliverable.findMany({
      where: { contractId },
      select: { id: true, title: true },
    });
    const payments = await this.prisma.payment.findMany({
      where: { contractId },
      select: { id: true },
    });

    const resourceFilter = [
      { resource: 'Contract', resourceId: contractId },
      ...deliverables.map((d) => ({ resource: 'Deliverable', resourceId: d.id })),
      ...payments.map((p) => ({ resource: 'Payment', resourceId: p.id })),
    ];

    const entries = await this.prisma.auditLog.findMany({
      where: { OR: resourceFilter },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Annotate each entry with its related resource title where available
    return entries.map((entry) => {
      const deliverable = deliverables.find((d) => d.id === entry.resourceId);
      return {
        ...entry,
        resourceLabel: deliverable?.title ?? entry.resource,
      };
    });
  }
}
