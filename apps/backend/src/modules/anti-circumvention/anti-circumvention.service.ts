import { Injectable, Logger } from '@nestjs/common';
import { ContractStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export const NO_CIRCUMVENTION_CLAUSE = {
  type: 'no_circumvention',
  title: 'Non-Circumvention',
  text:
    'During this engagement and for twelve (12) months after it ends, the parties agree to conduct all ' +
    'communication, negotiation, deliverable delivery, and payment for this relationship through the Conic ' +
    'platform. Neither party will solicit or transact the same or substantially similar services with the ' +
    'other off-platform, nor share private contact details to circumvent the platform, without Conic’s ' +
    'written consent. Breach entitles Conic to its platform fee on any circumvented transaction plus remedies at law.',
};

@Injectable()
export class AntiCircumventionService {
  private readonly logger = new Logger(AntiCircumventionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The standard non-circumvention clause to embed in generated contracts. */
  standardClause() {
    return NO_CIRCUMVENTION_CLAUSE;
  }

  /**
   * True when a brand may see a creator/athlete's real contact details — i.e. an
   * active or completed contract (creator) or an active NIL deal (athlete) exists.
   */
  async canRevealContact(brandUserId: string, targetType: 'creator' | 'athlete', targetId: string): Promise<boolean> {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId }, select: { id: true } });
    if (!brand) return false;

    if (targetType === 'creator') {
      const contract = await this.prisma.contract.findFirst({
        where: {
          brandId: brand.id,
          creatorId: targetId,
          status: { in: [ContractStatus.ACTIVE, ContractStatus.COMPLETED] },
        },
        select: { id: true },
      });
      return !!contract;
    }

    const deal = await this.prisma.nilDeal.findFirst({
      where: { brandId: brand.id, athleteId: targetId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      select: { id: true },
    });
    return !!deal;
  }

  /** Record a detected off-platform contact attempt from a deal-room message. */
  async recordMessageFlag(input: {
    dealRoomId: string;
    contractId?: string;
    actorUserId: string;
    categories: string[];
    severity: 'low' | 'medium' | 'high';
    detail: string;
  }): Promise<void> {
    await this.prisma.circumventionFlag.create({
      data: {
        kind: 'message_contact',
        severity: input.severity,
        dealRoomId: input.dealRoomId,
        contractId: input.contractId,
        actorUserId: input.actorUserId,
        categories: input.categories,
        detail: input.detail,
      },
    });
    void this.audit.log({
      userId: input.actorUserId,
      action: 'CIRCUMVENTION_ATTEMPT',
      resource: 'DealRoom',
      resourceId: input.dealRoomId,
      newValue: { categories: input.categories, severity: input.severity },
    });
    this.logger.warn(`Circumvention flagged in deal room ${input.dealRoomId}: ${input.categories.join(', ')}`);
  }

  /** Report of flags — all for ADMIN, brand-scoped otherwise. */
  async getReport(userId: string, role: UserRole) {
    let where = {};
    if (role !== UserRole.ADMIN) {
      const brand = await this.prisma.brand.findUnique({ where: { userId }, select: { id: true } });
      where = { brandId: brand?.id ?? '__none__' };
    }

    const [flags, total, bySeverity] = await Promise.all([
      this.prisma.circumventionFlag.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.circumventionFlag.count({ where }),
      this.prisma.circumventionFlag.groupBy({ by: ['severity'], where, _count: true }),
    ]);

    return {
      total,
      bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count])),
      flags,
    };
  }
}
