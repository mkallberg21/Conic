import { Injectable } from '@nestjs/common';
import { ContractStatus, PaymentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const SELF_EMPLOYMENT_TAX_RATE = 0.153;
const PLATFORM_FEE_RATE = 0.05;
const ACTIVE_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.PENDING_SIGNATURE,
  ContractStatus.ACTIVE,
];

@Injectable()
export class EarningsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, role: UserRole) {
    if (role === UserRole.CREATOR) return this.getCreatorSummary(userId);
    if (role === UserRole.ATHLETE) return this.getAthleteSummary(userId);
    if (role === UserRole.BRAND) return this.getBrandSummary(userId);
    return { error: 'Earnings summary not available for this role' };
  }

  async getBreakdown(userId: string, role: UserRole, year: number) {
    if (role === UserRole.CREATOR) return this.getCreatorBreakdown(userId, year);
    if (role === UserRole.ATHLETE) return this.getAthleteBreakdown(userId, year);
    if (role === UserRole.BRAND) return this.getBrandBreakdown(userId, year);
    return { monthly: [], year };
  }

  async getPipeline(userId: string, role: UserRole) {
    if (role === UserRole.CREATOR) return this.getCreatorPipeline(userId);
    if (role === UserRole.ATHLETE) return this.getAthletePipeline(userId);
    if (role === UserRole.BRAND) return this.getBrandPipeline(userId);
    return { pipeline: [], totalCents: 0 };
  }

  // ─── Creator ──────────────────────────────────────────────────────────────

  private async getCreatorSummary(userId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!creator) return this.emptyCreatorSummary();

    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    const [paidPayments, pendingPayments, activeContracts, recentPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          contract: { creatorId: creator.id },
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: ytdStart },
        },
        select: { netAmount: true, paidAt: true },
      }),
      this.prisma.payment.findMany({
        where: {
          contract: { creatorId: creator.id },
          status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        },
        select: { amount: true, dueDate: true },
      }),
      this.prisma.contract.findMany({
        where: {
          creatorId: creator.id,
          status: { in: ACTIVE_CONTRACT_STATUSES },
        },
        select: { id: true, totalValue: true, title: true },
      }),
      this.prisma.payment.findMany({
        where: {
          contract: { creatorId: creator.id },
          status: PaymentStatus.COMPLETED,
        },
        orderBy: { paidAt: 'desc' },
        take: 5,
        include: { contract: { select: { title: true } } },
      }),
    ]);

    const ytdEarningsCents = paidPayments.reduce((s, p) => s + p.netAmount, 0);
    const pendingCents = pendingPayments.reduce((s, p) => s + p.amount, 0);
    const pipelineCents = activeContracts.reduce((s, c) => s + c.totalValue, 0);
    const taxEstimateCents = Math.round(ytdEarningsCents * SELF_EMPLOYMENT_TAX_RATE);

    return {
      ytdEarningsCents,
      pendingCents,
      pipelineCents,
      taxEstimateCents,
      taxRate: SELF_EMPLOYMENT_TAX_RATE,
      platformFeeRate: PLATFORM_FEE_RATE,
      activeContractCount: activeContracts.length,
      recentPayments,
    };
  }

  private async getCreatorBreakdown(userId: string, year: number) {
    const creator = await this.prisma.creator.findUnique({ where: { userId }, select: { id: true } });
    if (!creator) return { monthly: [], year };

    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        contract: { creatorId: creator.id },
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: start, lt: end },
      },
      select: { netAmount: true, paidAt: true },
    });

    return { monthly: this.aggregateMonthly(payments, year), year };
  }

  private async getCreatorPipeline(userId: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId }, select: { id: true } });
    if (!creator) return { pipeline: [], totalCents: 0 };

    const contracts = await this.prisma.contract.findMany({
      where: { creatorId: creator.id, status: { in: ACTIVE_CONTRACT_STATUSES } },
      include: { brand: { select: { companyName: true } } },
    });

    const pipeline = contracts.map((c) => ({
      contractId: c.id,
      title: c.title,
      brand: c.brand.companyName,
      totalValueCents: c.totalValue,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
    }));

    return { pipeline, totalCents: pipeline.reduce((s, c) => s + c.totalValueCents, 0) };
  }

  // ─── Athlete ──────────────────────────────────────────────────────────────

  private async getAthleteSummary(userId: string) {
    const athlete = await this.prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
    if (!athlete) return this.emptyCreatorSummary();

    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    const [nilDeals, distributions, recentDists] = await Promise.all([
      this.prisma.nilDeal.findMany({
        where: { athleteId: athlete.id, status: 'ACTIVE' },
        select: { valueCents: true, title: true },
      }),
      this.prisma.collectiveDistribution.findMany({
        where: {
          collective: { members: { some: { athleteId: athlete.id } } },
          paidAt: { gte: ytdStart },
        },
        select: { amountCents: true, paidAt: true },
      }),
      this.prisma.collectiveDistribution.findMany({
        where: { collective: { members: { some: { athleteId: athlete.id } } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { collective: { select: { name: true } } },
      }),
    ]);

    const ytdDistributionCents = distributions.reduce((s: number, d: { amountCents: number }) => s + d.amountCents, 0);
    const activeDealValueCents = nilDeals.reduce((s: number, d: { valueCents: number }) => s + d.valueCents, 0);
    const taxEstimateCents = Math.round(ytdDistributionCents * SELF_EMPLOYMENT_TAX_RATE);

    return {
      ytdDistributionCents,
      activeDealValueCents,
      nilDealCount: nilDeals.length,
      taxEstimateCents,
      taxRate: SELF_EMPLOYMENT_TAX_RATE,
      recentDistributions: recentDists,
    };
  }

  private async getAthleteBreakdown(userId: string, year: number) {
    const athlete = await this.prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
    if (!athlete) return { monthly: [], year };

    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const distributions = await this.prisma.collectiveDistribution.findMany({
      where: {
        collective: { members: { some: { athleteId: athlete.id } } },
        paidAt: { gte: start, lt: end },
      },
      select: { amountCents: true, paidAt: true },
    });

    return {
      monthly: this.aggregateMonthly(
        distributions.map((d: { amountCents: number; paidAt: Date | null }) => ({ netAmount: d.amountCents, paidAt: d.paidAt })),
        year,
      ),
      year,
    };
  }

  private async getAthletePipeline(userId: string) {
    const athlete = await this.prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
    if (!athlete) return { pipeline: [], totalCents: 0 };

    const deals = await this.prisma.nilDeal.findMany({
      where: { athleteId: athlete.id, status: { in: ['PENDING', 'ACTIVE'] } },
      include: { brand: { select: { companyName: true } } },
    });

    const pipeline = deals.map((d) => ({
      dealId: d.id,
      title: d.title,
      brand: d.brand?.companyName,
      totalValueCents: d.valueCents,
      status: d.status,
    }));

    return { pipeline, totalCents: pipeline.reduce((s, d) => s + d.totalValueCents, 0) };
  }

  // ─── Brand ────────────────────────────────────────────────────────────────

  private async getBrandSummary(userId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId }, select: { id: true } });
    if (!brand) return {};

    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    const [ytdSpend, pendingPayments, activeContracts] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          contract: { brandId: brand.id },
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: ytdStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          contract: { brandId: brand.id },
          status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        },
        _sum: { amount: true },
      }),
      this.prisma.contract.count({
        where: { brandId: brand.id, status: { in: ACTIVE_CONTRACT_STATUSES } },
      }),
    ]);

    return {
      ytdSpendCents: ytdSpend._sum.amount ?? 0,
      pendingCents: pendingPayments._sum.amount ?? 0,
      activeContractCount: activeContracts,
    };
  }

  private async getBrandBreakdown(userId: string, year: number) {
    const brand = await this.prisma.brand.findUnique({ where: { userId }, select: { id: true } });
    if (!brand) return { monthly: [], year };

    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        contract: { brandId: brand.id },
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: start, lt: end },
      },
      select: { amount: true, paidAt: true },
    });

    return {
      monthly: this.aggregateMonthly(
        payments.map((p) => ({ netAmount: p.amount, paidAt: p.paidAt })),
        year,
      ),
      year,
    };
  }

  private async getBrandPipeline(userId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId }, select: { id: true } });
    if (!brand) return { pipeline: [], totalCents: 0 };

    const contracts = await this.prisma.contract.findMany({
      where: { brandId: brand.id, status: { in: ACTIVE_CONTRACT_STATUSES } },
      include: { creator: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const pipeline = contracts.map((c) => ({
      contractId: c.id,
      title: c.title,
      creator: `${c.creator.user.firstName} ${c.creator.user.lastName}`,
      totalValueCents: c.totalValue,
      status: c.status,
    }));

    return { pipeline, totalCents: pipeline.reduce((s, c) => s + c.totalValueCents, 0) };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private aggregateMonthly(
    rows: Array<{ netAmount: number; paidAt: Date | null }>,
    year: number,
  ) {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      year,
      totalCents: 0,
      count: 0,
    }));

    for (const row of rows) {
      if (!row.paidAt) continue;
      const m = new Date(row.paidAt).getMonth(); // 0-indexed
      months[m].totalCents += row.netAmount;
      months[m].count += 1;
    }

    return months;
  }

  private emptyCreatorSummary() {
    return {
      ytdEarningsCents: 0,
      pendingCents: 0,
      pipelineCents: 0,
      taxEstimateCents: 0,
      taxRate: SELF_EMPLOYMENT_TAX_RATE,
      platformFeeRate: PLATFORM_FEE_RATE,
      activeContractCount: 0,
      recentPayments: [],
    };
  }
}
