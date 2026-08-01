import {
  Injectable,
  NotFoundException,  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CollectiveMemberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  CreateCollectiveDto,
  AddMemberDto,
  RecordDonationDto,
  CreateDistributionDto,
} from './dto/collective-portal.dto';

@Injectable()
export class CollectivePortalService {
  private readonly logger = new Logger(CollectivePortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Collectives ────────────────────────────────────────────────────────────

  async create(callerId: string, dto: CreateCollectiveDto) {
    const existing = await this.prisma.nilCollective.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already in use');

    const collective = await this.prisma.nilCollective.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        universityId: dto.universityId,
        sport: dto.sport,
        website: dto.website,
        description: dto.description,
        contactEmail: dto.contactEmail,
        ein: dto.ein,
      },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'COLLECTIVE_CREATED',
      resource: 'NilCollective',
      resourceId: collective.id,
      newValue: { name: dto.name, slug: dto.slug },
    });

    return collective;
  }

  async findAll(universityId?: string) {
    return this.prisma.nilCollective.findMany({
      where: universityId ? { universityId } : undefined,
      include: {
        university: { select: { name: true, shortName: true } },
        _count: { select: { members: true, donors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const collective = await this.prisma.nilCollective.findUnique({
      where: { id },
      include: {
        university: { select: { name: true, shortName: true } },
        members: {
          where: { status: CollectiveMemberStatus.ACTIVE },
          include: {
            athlete: {
              include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
            },
          },
          orderBy: { sharePercent: 'desc' },
        },
        _count: { select: { donors: true, donations: true, distributions: true } },
      },
    });
    if (!collective) throw new NotFoundException('Collective not found');
    return collective;
  }

  // ─── Members ────────────────────────────────────────────────────────────────

  async addMember(collectiveId: string, callerId: string, dto: AddMemberDto) {
    await this.assertCollectiveExists(collectiveId);

    const athlete = await this.prisma.athlete.findUnique({ where: { id: dto.athleteId } });
    if (!athlete) throw new NotFoundException('Athlete not found');

    const existing = await this.prisma.collectiveMember.findUnique({
      where: { collectiveId_athleteId: { collectiveId, athleteId: dto.athleteId } },
    });
    if (existing && existing.status === CollectiveMemberStatus.ACTIVE) {
      throw new ConflictException('Athlete is already an active member');
    }

    const member = await this.prisma.collectiveMember.upsert({
      where: { collectiveId_athleteId: { collectiveId, athleteId: dto.athleteId } },
      create: {
        collectiveId,
        athleteId: dto.athleteId,
        sharePercent: dto.sharePercent ?? 0,
        notes: dto.notes,
        status: CollectiveMemberStatus.ACTIVE,
      },
      update: {
        status: CollectiveMemberStatus.ACTIVE,
        sharePercent: dto.sharePercent ?? 0,
        notes: dto.notes,
        leftAt: null,
      },
      include: { athlete: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'COLLECTIVE_MEMBER_ADDED',
      resource: 'CollectiveMember',
      resourceId: member.id,
      newValue: { collectiveId, athleteId: dto.athleteId },
    });

    return member;
  }

  async removeMember(collectiveId: string, memberId: string, callerId: string) {
    const member = await this.prisma.collectiveMember.findUnique({ where: { id: memberId } });
    if (!member || member.collectiveId !== collectiveId) throw new NotFoundException('Member not found');

    const updated = await this.prisma.collectiveMember.update({
      where: { id: memberId },
      data: { status: CollectiveMemberStatus.REMOVED, leftAt: new Date() },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'COLLECTIVE_MEMBER_REMOVED',
      resource: 'CollectiveMember',
      resourceId: memberId,
      newValue: { collectiveId },
    });

    return updated;
  }

  // ─── Donations ──────────────────────────────────────────────────────────────

  async recordDonation(collectiveId: string, callerId: string, dto: RecordDonationDto) {
    await this.assertCollectiveExists(collectiveId);

    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert donor record
      const donor = await tx.collectiveDonor.upsert({
        where: { collectiveId_email: { collectiveId, email: dto.email } },
        create: {
          collectiveId,
          displayName: dto.displayName,
          email: dto.email,
          isAnonymous: dto.isAnonymous ?? false,
          totalDonatedCents: dto.amountCents,
          donationCount: 1,
          lastDonatedAt: new Date(),
        },
        update: {
          totalDonatedCents: { increment: dto.amountCents },
          donationCount: { increment: 1 },
          lastDonatedAt: new Date(),
        },
      });

      const donation = await tx.collectiveDonation.create({
        data: {
          donorId: donor.id,
          collectiveId,
          amountCents: dto.amountCents,
          note: dto.note,
          isRecurring: dto.isRecurring ?? false,
          status: 'COMPLETED',
          donatedAt: new Date(),
        },
      });

      // Update collective total
      await tx.nilCollective.update({
        where: { id: collectiveId },
        data: { totalFundsRaisedCents: { increment: dto.amountCents } },
      });

      return { donor, donation };
    });

    void this.auditService.log({
      userId: callerId,
      action: 'COLLECTIVE_DONATION_RECORDED',
      resource: 'CollectiveDonation',
      resourceId: result.donation.id,
      newValue: { collectiveId, amountCents: dto.amountCents },
    });

    return result;
  }

  async getDonors(collectiveId: string) {
    await this.assertCollectiveExists(collectiveId);
    return this.prisma.collectiveDonor.findMany({
      where: { collectiveId },
      orderBy: { totalDonatedCents: 'desc' },
    });
  }

  // ─── Distributions ──────────────────────────────────────────────────────────

  async createDistribution(collectiveId: string, callerId: string, dto: CreateDistributionDto) {
    const collective = await this.prisma.nilCollective.findUnique({ where: { id: collectiveId } });
    if (!collective) throw new NotFoundException('Collective not found');

    const availableFunds = collective.totalFundsRaisedCents - collective.totalPaidOutCents;
    if (dto.totalAmountCents > availableFunds) {
      throw new BadRequestException(
        `Insufficient funds. Available: ${availableFunds} cents, requested: ${dto.totalAmountCents} cents`,
      );
    }

    // Validate all member IDs belong to this collective
    const members = await this.prisma.collectiveMember.findMany({
      where: {
        id: { in: dto.memberIds },
        collectiveId,
        status: CollectiveMemberStatus.ACTIVE,
      },
    });

    if (members.length !== dto.memberIds.length) {
      throw new BadRequestException('One or more member IDs are invalid or inactive');
    }

    // Calculate per-member amount based on sharePercent
    const totalShare = members.reduce((sum, m) => sum + m.sharePercent, 0);
    if (totalShare === 0) throw new BadRequestException('Members have no share percentages set');

    const distributions = await this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        members.map((m) => {
          const amount = Math.floor((m.sharePercent / totalShare) * dto.totalAmountCents);
          return tx.collectiveDistribution.create({
            data: {
              collectiveId,
              memberId: m.id,
              athleteId: m.athleteId,
              amountCents: amount,
              reason: dto.reason,
              periodStart: new Date(dto.periodStart),
              periodEnd: new Date(dto.periodEnd),
              status: 'PENDING',
              taxYear: dto.taxYear,
            },
          });
        }),
      );

      await tx.nilCollective.update({
        where: { id: collectiveId },
        data: { totalPaidOutCents: { increment: dto.totalAmountCents } },
      });

      return created;
    });

    void this.auditService.log({
      userId: callerId,
      action: 'COLLECTIVE_DISTRIBUTION_CREATED',
      resource: 'CollectiveDistribution',
      resourceId: collectiveId,
      newValue: { totalAmountCents: dto.totalAmountCents, memberCount: members.length },
    });

    return distributions;
  }

  async getDistributions(collectiveId: string) {
    await this.assertCollectiveExists(collectiveId);
    return this.prisma.collectiveDistribution.findMany({
      where: { collectiveId },
      include: {
        member: {
          include: {
            athlete: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  async getSummary(collectiveId: string) {
    const [collective, donationAgg, distAgg, memberCount] = await Promise.all([
      this.prisma.nilCollective.findUnique({ where: { id: collectiveId } }),
      this.prisma.collectiveDonation.aggregate({
        where: { collectiveId, status: 'COMPLETED' },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.collectiveDistribution.aggregate({
        where: { collectiveId, status: 'PAID' },
        _sum: { amountCents: true },
      }),
      this.prisma.collectiveMember.count({
        where: { collectiveId, status: CollectiveMemberStatus.ACTIVE },
      }),
    ]);

    if (!collective) throw new NotFoundException('Collective not found');

    return {
      collective,
      totalRaisedCents: donationAgg._sum.amountCents ?? 0,
      totalDonations: donationAgg._count,
      totalPaidOutCents: distAgg._sum.amountCents ?? 0,
      availableFundsCents:
        (donationAgg._sum.amountCents ?? 0) - (distAgg._sum.amountCents ?? 0),
      activeMembers: memberCount,
    };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async assertCollectiveExists(id: string) {
    const c = await this.prisma.nilCollective.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Collective not found');
    return c;
  }
}
