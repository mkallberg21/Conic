import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ApprovalStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly auditService: AuditService,
  ) {}

  async getLinkedAthletes(guardianUserId: string) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { userId: guardianUserId },
      include: {
        athleteRelationships: {
          include: {
            athlete: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                university: { select: { name: true, shortName: true } },
                nilDeals: {
                  where: { status: { in: ['PENDING', 'ACTIVE'] } },
                  select: { id: true, title: true, valueCents: true, status: true },
                },
              },
            },
          },
        },
      },
    });
    if (!guardian) throw new NotFoundException('Guardian profile not found');
    return guardian.athleteRelationships;
  }

  async getPendingApprovals(guardianUserId: string) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { userId: guardianUserId },
    });
    if (!guardian) throw new NotFoundException('Guardian profile not found');

    return this.prisma.guardianApproval.findMany({
      where: { guardianId: guardian.id, status: ApprovalStatus.PENDING },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async respond(
    guardianUserId: string,
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string,
    ipAddress?: string,
  ) {
    const guardian = await this.prisma.guardian.findUnique({ where: { userId: guardianUserId } });
    if (!guardian) throw new NotFoundException('Guardian profile not found');

    const approval = await this.prisma.guardianApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval request not found');
    if (approval.guardianId !== guardian.id) throw new ForbiddenException('Not your approval request');
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new ForbiddenException('This request has already been responded to');
    }
    if (new Date() > approval.expiresAt) {
      await this.prisma.guardianApproval.update({
        where: { id: approvalId },
        data: { status: ApprovalStatus.EXPIRED },
      });
      throw new ForbiddenException('This approval request has expired');
    }

    const updated = await this.prisma.guardianApproval.update({
      where: { id: approvalId },
      data: {
        status: decision === 'APPROVED' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        respondedAt: new Date(),
        notes,
        ipAddress,
      },
    });

    // If approved, update the resource
    if (decision === 'APPROVED') {
      await this.applyApproval(approval.resourceType, approval.resourceId);
    }

    this.eventBus.emit(
      decision === 'APPROVED'
        ? EVENTS.GUARDIAN_APPROVED
        : EVENTS.GUARDIAN_REJECTED,
      {
        approvalId,
        guardianId: guardian.id,
        resourceType: approval.resourceType,
        resourceId: approval.resourceId,
        decision,
      },
    );

    void this.auditService.log({
      userId: guardianUserId,
      action: `GUARDIAN_${decision}`,
      resource: 'GuardianApproval',
      resourceId: approvalId,
      newValue: { decision, resourceType: approval.resourceType, resourceId: approval.resourceId },
      ipAddress,
    });

    return updated;
  }

  async requestApproval(
    resourceType: string,
    resourceId: string,
    athleteId: string,
    expiryHours = 72,
  ) {
    const relationships = await this.prisma.guardianRelationship.findMany({
      where: { athleteId, canApprove: true },
      include: { guardian: true },
    });

    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const approvals = await this.prisma.$transaction(
      relationships.map((rel) =>
        this.prisma.guardianApproval.create({
          data: {
            guardianId: rel.guardianId,
            resourceType,
            resourceId,
            status: ApprovalStatus.PENDING,
            expiresAt,
          },
        }),
      ),
    );

    this.logger.log(
      `Requested guardian approval for ${resourceType} ${resourceId} from ${relationships.length} guardian(s)`,
    );

    return approvals;
  }

  private async applyApproval(resourceType: string, resourceId: string) {
    if (resourceType === 'nil_deal') {
      await this.prisma.nilDeal
        .update({ where: { id: resourceId }, data: { guardianApproved: true } })
        .catch(() => this.logger.warn(`Could not update nil_deal ${resourceId}`));
    } else if (resourceType === 'contract') {
      await this.prisma.contractNilExtension
        .updateMany({
          where: { contractId: resourceId },
          data: { guardianSignedAt: new Date() },
        })
        .catch(() => this.logger.warn(`Could not update contract extension for ${resourceId}`));
    }
  }
}
