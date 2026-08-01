import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { EarningsService } from './earnings.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  creator: { findUnique: jest.fn() },
  athlete: { findUnique: jest.fn() },
  brand: { findUnique: jest.fn() },
  payment: { findMany: jest.fn(), aggregate: jest.fn() },
  contract: { findMany: jest.fn(), count: jest.fn() },
  nilDeal: { findMany: jest.fn() },
  collectiveDistribution: { findMany: jest.fn() },
};

const SELF_EMPLOYMENT_TAX_RATE = 0.153;

describe('EarningsService', () => {
  let service: EarningsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EarningsService>(EarningsService);
    jest.clearAllMocks();
  });

  describe('getSummary role dispatch', () => {
    it('returns an error object for a role without earnings (e.g. GUARDIAN)', async () => {
      const result = await service.getSummary('user_1', UserRole.GUARDIAN);
      expect(result).toEqual({ error: expect.any(String) });
    });

    it('returns an empty creator summary when the user has no creator profile', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(null);

      const result = await service.getSummary('user_1', UserRole.CREATOR);

      expect(result).toEqual(
        expect.objectContaining({ ytdEarningsCents: 0, taxEstimateCents: 0, activeContractCount: 0 }),
      );
    });
  });

  describe('creator summary math', () => {
    it('sums YTD net earnings, pending, pipeline, and computes the 15.3% self-employment tax estimate', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      // Promise.all order: paidPayments, pendingPayments, activeContracts, recentPayments
      mockPrisma.payment.findMany
        .mockResolvedValueOnce([{ netAmount: 100_000 }, { netAmount: 50_000 }]) // paid → 150_000
        .mockResolvedValueOnce([{ amount: 20_000 }]) // pending → 20_000
        .mockResolvedValueOnce([]); // recentPayments
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 'c1', totalValue: 200_000, title: 'A' },
        { id: 'c2', totalValue: 100_000, title: 'B' },
      ]);

      const result = (await service.getSummary('user_1', UserRole.CREATOR)) as {
        ytdEarningsCents: number;
        pendingCents: number;
        pipelineCents: number;
        taxEstimateCents: number;
        activeContractCount: number;
      };

      expect(result.ytdEarningsCents).toBe(150_000);
      expect(result.pendingCents).toBe(20_000);
      expect(result.pipelineCents).toBe(300_000);
      expect(result.taxEstimateCents).toBe(Math.round(150_000 * SELF_EMPLOYMENT_TAX_RATE)); // 22_950
      expect(result.activeContractCount).toBe(2);
    });
  });

  describe('brand summary', () => {
    it('reports YTD spend and pending totals from payment aggregates', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 500_000 } }) // ytd spend
        .mockResolvedValueOnce({ _sum: { amount: 75_000 } }); // pending
      mockPrisma.contract.count.mockResolvedValue(3);

      const result = (await service.getSummary('user_1', UserRole.BRAND)) as {
        ytdSpendCents: number;
        pendingCents: number;
        activeContractCount: number;
      };

      expect(result.ytdSpendCents).toBe(500_000);
      expect(result.pendingCents).toBe(75_000);
      expect(result.activeContractCount).toBe(3);
    });
  });

  describe('getBreakdown monthly aggregation', () => {
    it('buckets completed payments into the correct calendar month', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      // Local mid-day dates so month bucketing is timezone-independent
      mockPrisma.payment.findMany.mockResolvedValue([
        { netAmount: 10_000, paidAt: new Date(2025, 1, 15, 12) }, // Feb → index 1
        { netAmount: 5_000, paidAt: new Date(2025, 1, 20, 12) },
        { netAmount: 8_000, paidAt: new Date(2025, 10, 1, 12) }, // Nov → index 10
      ]);

      const result = (await service.getBreakdown('user_1', UserRole.CREATOR, 2025)) as {
        monthly: Array<{ month: number; totalCents: number; count: number }>;
        year: number;
      };

      expect(result.year).toBe(2025);
      expect(result.monthly).toHaveLength(12);
      const feb = result.monthly[1];
      const nov = result.monthly[10];
      expect(feb).toMatchObject({ month: 2, totalCents: 15_000, count: 2 });
      expect(nov).toMatchObject({ month: 11, totalCents: 8_000, count: 1 });
    });
  });
});
