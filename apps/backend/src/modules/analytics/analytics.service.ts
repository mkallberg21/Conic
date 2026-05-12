import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformOverview() {
    const [users, contracts, payments, deliverables] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.contract.groupBy({ by: ['status'], _count: true }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.deliverable.groupBy({ by: ['status'], _count: true }),
    ]);

    return {
      totalUsers: users,
      contractsByStatus: contracts,
      paymentsProcessed: {
        count: payments._count,
        totalAmount: payments._sum.amount ?? 0,
      },
      deliverablesByStatus: deliverables,
    };
  }

  async getCampaignPerformance(brandUserId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId } });
    if (!brand) return null;

    const campaigns = await this.prisma.campaign.findMany({
      where: { brandId: brand.id },
      include: {
        summaries: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { tasks: true } },
      },
    });

    const totalSpend = await this.prisma.payment.aggregate({
      where: { contract: { brandId: brand.id }, status: 'COMPLETED' },
      _sum: { amount: true },
    });

    return {
      campaigns,
      totalSpend: totalSpend._sum.amount ?? 0,
      activeCampaigns: campaigns.filter((c) => c.status === 'ACTIVE').length,
    };
  }

  async getCreatorStats(creatorUserId: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: creatorUserId } });
    if (!creator) return null;

    const [earnings, deliverableStats, prediction] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { contract: { creatorId: creator.id }, status: 'COMPLETED' },
        _sum: { netAmount: true },
      }),
      this.prisma.deliverable.groupBy({
        by: ['status'],
        where: { creatorId: creator.id },
        _count: true,
      }),
      this.prisma.creatorPrediction.findFirst({
        where: { creatorId: creator.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      totalEarnings: earnings._sum.netAmount ?? 0,
      deliverablesByStatus: deliverableStats,
      latestPrediction: prediction,
      audienceScore: creator.audienceScore,
      performanceScore: creator.performanceScore,
    };
  }

  async getTopCreators(limit = 10) {
    return this.prisma.creator.findMany({
      take: limit,
      orderBy: { performanceScore: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        graphNode: { select: { influenceScore: true, trending: true } },
        predictions: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async getRevenueChart(brandUserId: string, days = 30) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId } });
    if (!brand) return [];

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const payments = await this.prisma.payment.findMany({
      where: {
        contract: { brandId: brand.id },
        status: 'COMPLETED',
        paidAt: { gte: since },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    // Group by day
    const grouped = payments.reduce(
      (acc, p) => {
        const day = p.paidAt?.toISOString().split('T')[0] ?? 'unknown';
        acc[day] = (acc[day] ?? 0) + p.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
  }

  async getTimeSeries(
    metric: 'revenue' | 'contracts' | 'deliverables',
    days = 30,
    brandUserId?: string,
  ) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    // Build a complete date scaffold
    const scaffold: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      scaffold[d.toISOString().split('T')[0]] = 0;
    }

    if (metric === 'revenue') {
      const brandFilter = brandUserId
        ? { contract: { brand: { userId: brandUserId } } }
        : {};
      const payments = await this.prisma.payment.findMany({
        where: { status: 'COMPLETED', paidAt: { gte: since }, ...brandFilter },
        select: { amount: true, paidAt: true },
      });
      payments.forEach((p) => {
        const day = p.paidAt?.toISOString().split('T')[0];
        if (day && scaffold[day] !== undefined) scaffold[day] += p.amount;
      });
    } else if (metric === 'contracts') {
      const brandFilter = brandUserId ? { brand: { userId: brandUserId } } : {};
      const contracts = await this.prisma.contract.findMany({
        where: { createdAt: { gte: since }, ...brandFilter },
        select: { createdAt: true },
      });
      contracts.forEach((c) => {
        const day = c.createdAt.toISOString().split('T')[0];
        if (scaffold[day] !== undefined) scaffold[day] += 1;
      });
    } else {
      // deliverables
      const deliverables = await this.prisma.deliverable.findMany({
        where: { submittedAt: { gte: since } },
        select: { submittedAt: true },
      });
      deliverables.forEach((d) => {
        const day = d.submittedAt?.toISOString().split('T')[0];
        if (day && scaffold[day] !== undefined) scaffold[day] += 1;
      });
    }

    return Object.entries(scaffold).map(([date, value]) => ({ date, value }));
  }

  async getCreatorComparison(creatorIds: string[]) {
    return this.prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: {
        id: true,
        handle: true,
        followersCount: true,
        engagementRate: true,
        performanceScore: true,
        fraudScore: true,
        audienceScore: true,
        pricingTier: true,
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        predictions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { predictedROI: true, predictedReach: true, confidence: true },
        },
      },
    });
  }
}
