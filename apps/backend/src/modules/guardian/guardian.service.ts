import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApprovalStatus, GuardianInviteStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { AuditService } from '../../common/audit/audit.service';
import { EmailService } from '../../common/email/email.service';

/** A minor is exactly one of these. */
export type MinorSubject = { athleteId?: string | null; creatorId?: string | null };

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly auditService: AuditService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ── Portal reads ───────────────────────────────────────────────────────────

  async getLinkedAthletes(guardianUserId: string) {
    const guardian = await this.requireGuardian(guardianUserId);
    return this.prisma.guardianRelationship.findMany({
      where: { guardianId: guardian.id, athleteId: { not: null } },
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
    });
  }

  /** Every minor (athlete OR creator) linked to this guardian. */
  async getLinkedMinors(guardianUserId: string) {
    const guardian = await this.requireGuardian(guardianUserId);
    return this.prisma.guardianRelationship.findMany({
      where: { guardianId: guardian.id },
      include: {
        athlete: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        creator: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingApprovals(guardianUserId: string) {
    const guardian = await this.requireGuardian(guardianUserId);
    return this.prisma.guardianApproval.findMany({
      where: { guardianId: guardian.id, status: ApprovalStatus.PENDING },
      orderBy: { requestedAt: 'asc' },
    });
  }

  // ── Approvals ────────────────────────────────────────────────────────────

  async respond(
    guardianUserId: string,
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string,
    ipAddress?: string,
  ) {
    const guardian = await this.requireGuardian(guardianUserId);

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

    if (decision === 'APPROVED') {
      await this.applyApproval(approval.resourceType, approval.resourceId);
    }

    this.eventBus.emit(
      decision === 'APPROVED' ? EVENTS.GUARDIAN_APPROVED : EVENTS.GUARDIAN_REJECTED,
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

  /**
   * Fan a pending approval request out to every guardian who can approve for the
   * minor (athlete OR creator). Idempotent per (guardian, resource): callers may
   * invoke it whenever an agreement is created for a minor.
   */
  async requestApproval(
    resourceType: string,
    resourceId: string,
    subject: MinorSubject,
    expiryHours = this.config.get<number>('guardian.approvalExpiryHours', 72),
  ) {
    const relationships = await this.prisma.guardianRelationship.findMany({
      where: { ...this.subjectWhere(subject), canApprove: true },
    });
    if (relationships.length === 0) return [];

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

  /** True once at least one guardian has APPROVED this resource. */
  async isApproved(resourceType: string, resourceId: string): Promise<boolean> {
    const approved = await this.prisma.guardianApproval.count({
      where: { resourceType, resourceId, status: ApprovalStatus.APPROVED },
    });
    return approved > 0;
  }

  /** True when the minor has at least one active (accepted) guardian link. */
  async hasActiveGuardian(subject: MinorSubject): Promise<boolean> {
    const count = await this.prisma.guardianRelationship.count({
      where: { ...this.subjectWhere(subject), canApprove: true },
    });
    return count > 0;
  }

  // ── Invite / accept ────────────────────────────────────────────────────────

  /**
   * Create a pending guardian invite for a minor and email the guardian a link
   * to accept it. Called at sign-up (and re-invokable from the profile).
   */
  async createInvite(params: {
    invitedByUserId: string;
    subject: MinorSubject;
    guardianEmail: string;
    relationship?: string;
    minorName?: string;
  }) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    const expiryHours = this.config.get<number>('guardian.inviteExpiryHours', 168);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Supersede any still-pending invite for this minor so only the newest
    // token is valid (this makes "resend" clean).
    await this.prisma.guardianInvite.updateMany({
      where: { ...this.subjectWhere(params.subject), status: GuardianInviteStatus.PENDING },
      data: { status: GuardianInviteStatus.REVOKED },
    });

    const invite = await this.prisma.guardianInvite.create({
      data: {
        invitedByUserId: params.invitedByUserId,
        athleteId: params.subject.athleteId ?? null,
        creatorId: params.subject.creatorId ?? null,
        guardianEmail: params.guardianEmail.toLowerCase(),
        relationship: params.relationship ?? 'parent',
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl') ?? this.config.get<string>('app.corsOrigin');
    const acceptUrl = `${frontendUrl}/guardian/accept?token=${token}`;
    // Best-effort — a transient email failure must not fail registration.
    await this.email
      .sendGuardianInvite(params.guardianEmail, { acceptUrl, minorName: params.minorName ?? 'a minor' })
      .catch((err) => this.logger.warn(`Guardian invite email failed: ${(err as Error).message}`));

    void this.auditService.log({
      userId: params.invitedByUserId,
      action: 'GUARDIAN_INVITED',
      resource: 'GuardianInvite',
      resourceId: invite.id,
      newValue: { guardianEmail: params.guardianEmail },
    });

    return { inviteId: invite.id, expiresAt };
  }

  /** Guardian accepts an invite, materialising a verified GuardianRelationship. */
  async acceptInvite(guardianUserId: string, token: string) {
    const invite = await this.prisma.guardianInvite.findUnique({ where: { tokenHash: sha256(token) } });
    if (!invite || invite.status !== GuardianInviteStatus.PENDING) {
      throw new BadRequestException('This invite is invalid or has already been used.');
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.guardianInvite.update({
        where: { id: invite.id },
        data: { status: GuardianInviteStatus.EXPIRED },
      });
      throw new BadRequestException('This invite has expired — ask the minor to resend it.');
    }

    let guardian = await this.prisma.guardian.findUnique({ where: { userId: guardianUserId } });
    if (!guardian) {
      guardian = await this.prisma.guardian.create({
        data: { userId: guardianUserId, relationship: invite.relationship },
      });
    }

    let relationship;
    try {
      relationship = await this.prisma.guardianRelationship.create({
        data: {
          guardianId: guardian.id,
          athleteId: invite.athleteId,
          creatorId: invite.creatorId,
          relationship: invite.relationship,
          isPrimary: true,
          canApprove: true,
        },
      });
    } catch (err) {
      // Unique (guardianId, athleteId|creatorId) — link already exists; treat as success.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        relationship = await this.prisma.guardianRelationship.findFirst({
          where: { guardianId: guardian.id, ...this.subjectWhere(invite) },
        });
      } else {
        throw err;
      }
    }

    await this.prisma.guardianInvite.update({
      where: { id: invite.id },
      data: { status: GuardianInviteStatus.ACCEPTED, acceptedAt: new Date(), acceptedGuardianId: guardian.id },
    });

    void this.auditService.log({
      userId: guardianUserId,
      action: 'GUARDIAN_LINK_ACCEPTED',
      resource: 'GuardianRelationship',
      resourceId: relationship?.id,
      newValue: { athleteId: invite.athleteId, creatorId: invite.creatorId },
    });

    return relationship;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async requireGuardian(guardianUserId: string) {
    const guardian = await this.prisma.guardian.findUnique({ where: { userId: guardianUserId } });
    if (!guardian) throw new NotFoundException('Guardian profile not found');
    return guardian;
  }

  private subjectWhere(subject: MinorSubject) {
    if (subject.athleteId) return { athleteId: subject.athleteId };
    if (subject.creatorId) return { creatorId: subject.creatorId };
    throw new BadRequestException('A minor subject (athlete or creator) is required');
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

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}
