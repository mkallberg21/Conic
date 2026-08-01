import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CollectiveMemberStatus } from '@prisma/client';
import { CollectivePortalService } from './collective-portal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  CreateCollectiveDto,
  AddMemberDto,
  RecordDonationDto,
  CreateDistributionDto,
} from './dto/collective-portal.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  nilCollective: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  collectiveMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  collectiveDonor: { upsert: jest.fn(), findMany: jest.fn() },
  collectiveDonation: { create: jest.fn(), aggregate: jest.fn() },
  collectiveDistribution: { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
  athlete: { findUnique: jest.fn() },
  // $transaction invokes the callback with a transactional client (here, the same mock)
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn() };

const CALLER = 'user_admin_1';

describe('CollectivePortalService', () => {
  let service: CollectivePortalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectivePortalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CollectivePortalService>(CollectivePortalService);
    jest.clearAllMocks();
    // Default: run the transaction callback against the mock prisma client
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    );
  });

  describe('create', () => {
    it('throws ConflictException when the slug is already in use', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({ id: 'col_1', slug: 'taken' });

      await expect(
        service.create(CALLER, { name: 'X', slug: 'taken' } as CreateCollectiveDto),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.nilCollective.create).not.toHaveBeenCalled();
    });

    it('creates the collective and writes an audit log when the slug is free', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue(null);
      mockPrisma.nilCollective.create.mockResolvedValue({ id: 'col_new', slug: 'free' });

      const result = await service.create(CALLER, {
        name: 'Boosters',
        slug: 'free',
      } as CreateCollectiveDto);

      expect(result).toEqual({ id: 'col_new', slug: 'free' });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COLLECTIVE_CREATED', resourceId: 'col_new' }),
      );
    });
  });

  describe('addMember', () => {
    it('throws ConflictException when the athlete is already an active member', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({ id: 'col_1' });
      mockPrisma.athlete.findUnique.mockResolvedValue({ id: 'ath_1' });
      mockPrisma.collectiveMember.findUnique.mockResolvedValue({
        id: 'mem_1',
        status: CollectiveMemberStatus.ACTIVE,
      });

      await expect(
        service.addMember('col_1', CALLER, { athleteId: 'ath_1' } as AddMemberDto),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.collectiveMember.upsert).not.toHaveBeenCalled();
    });
  });

  describe('recordDonation', () => {
    it('upserts the donor, records the donation, and increments the collective total inside a transaction', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({ id: 'col_1' });
      mockPrisma.collectiveDonor.upsert.mockResolvedValue({ id: 'donor_1' });
      mockPrisma.collectiveDonation.create.mockResolvedValue({ id: 'don_1' });
      mockPrisma.nilCollective.update.mockResolvedValue({});

      const dto: RecordDonationDto = {
        displayName: 'Jane Donor',
        email: 'jane@example.com',
        amountCents: 5000,
      };

      const result = await service.recordDonation('col_1', CALLER, dto);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.collectiveDonor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { collectiveId_email: { collectiveId: 'col_1', email: 'jane@example.com' } },
        }),
      );
      expect(mockPrisma.collectiveDonation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amountCents: 5000 }) }),
      );
      expect(mockPrisma.nilCollective.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalFundsRaisedCents: { increment: 5000 } },
        }),
      );
      expect(result).toEqual({ donor: { id: 'donor_1' }, donation: { id: 'don_1' } });
    });
  });

  describe('createDistribution', () => {
    const baseDto: CreateDistributionDto = {
      memberIds: ['m1', 'm2'],
      totalAmountCents: 10_000,
      reason: 'Q1 distribution',
      periodStart: '2025-01-01',
      periodEnd: '2025-03-31',
      taxYear: 2025,
    };

    it('throws BadRequestException when requested amount exceeds available funds', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({
        id: 'col_1',
        totalFundsRaisedCents: 5_000,
        totalPaidOutCents: 0,
      });

      await expect(service.createDistribution('col_1', CALLER, baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when a member ID is invalid or inactive', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({
        id: 'col_1',
        totalFundsRaisedCents: 100_000,
        totalPaidOutCents: 0,
      });
      // Only one of the two requested members comes back
      mockPrisma.collectiveMember.findMany.mockResolvedValue([
        { id: 'm1', athleteId: 'a1', sharePercent: 60 },
      ]);

      await expect(service.createDistribution('col_1', CALLER, baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when members have no share percentages set', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({
        id: 'col_1',
        totalFundsRaisedCents: 100_000,
        totalPaidOutCents: 0,
      });
      mockPrisma.collectiveMember.findMany.mockResolvedValue([
        { id: 'm1', athleteId: 'a1', sharePercent: 0 },
        { id: 'm2', athleteId: 'a2', sharePercent: 0 },
      ]);

      await expect(service.createDistribution('col_1', CALLER, baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('distributes funds proportionally by share percent and increments totalPaidOutCents', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({
        id: 'col_1',
        totalFundsRaisedCents: 100_000,
        totalPaidOutCents: 0,
      });
      mockPrisma.collectiveMember.findMany.mockResolvedValue([
        { id: 'm1', athleteId: 'a1', sharePercent: 60 },
        { id: 'm2', athleteId: 'a2', sharePercent: 40 },
      ]);
      mockPrisma.collectiveDistribution.create.mockImplementation(
        async (args: { data: { amountCents: number } }) => args.data,
      );
      mockPrisma.nilCollective.update.mockResolvedValue({});

      await service.createDistribution('col_1', CALLER, baseDto);

      // 60/40 split of 10_000 → 6_000 / 4_000
      expect(mockPrisma.collectiveDistribution.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memberId: 'm1', amountCents: 6_000 }) }),
      );
      expect(mockPrisma.collectiveDistribution.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memberId: 'm2', amountCents: 4_000 }) }),
      );
      expect(mockPrisma.nilCollective.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalPaidOutCents: { increment: 10_000 } } }),
      );
    });
  });

  describe('getSummary', () => {
    it('computes available funds as completed donations minus paid distributions', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue({ id: 'col_1', name: 'Boosters' });
      mockPrisma.collectiveDonation.aggregate.mockResolvedValue({
        _sum: { amountCents: 90_000 },
        _count: 12,
      });
      mockPrisma.collectiveDistribution.aggregate.mockResolvedValue({ _sum: { amountCents: 30_000 } });
      mockPrisma.collectiveMember.count.mockResolvedValue(4);

      const summary = await service.getSummary('col_1');

      expect(summary.totalRaisedCents).toBe(90_000);
      expect(summary.totalPaidOutCents).toBe(30_000);
      expect(summary.availableFundsCents).toBe(60_000);
      expect(summary.activeMembers).toBe(4);
    });

    it('throws NotFoundException when the collective does not exist', async () => {
      mockPrisma.nilCollective.findUnique.mockResolvedValue(null);
      mockPrisma.collectiveDonation.aggregate.mockResolvedValue({ _sum: {}, _count: 0 });
      mockPrisma.collectiveDistribution.aggregate.mockResolvedValue({ _sum: {} });
      mockPrisma.collectiveMember.count.mockResolvedValue(0);

      await expect(service.getSummary('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
