import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCreatorDto } from './dto/create-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: { niche?: string; platform?: string; minFollowers?: number }) {
    return this.prisma.creator.findMany({
      where: {
        ...(filters?.niche ? { niche: { has: filters.niche } } : {}),
        ...(filters?.minFollowers ? { followersCount: { gte: filters.minFollowers } } : {}),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        graphNode: { select: { influenceScore: true, trending: true, clusterId: true } },
      },
      orderBy: { performanceScore: 'desc' },
    });
  }

  async findById(id: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        graphNode: true,
        predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { contracts: true, deliverables: true } },
      },
    });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator;
  }

  async findByUserId(userId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        graphNode: true,
        predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { contracts: true, deliverables: true } },
      },
    });
    if (!creator) throw new NotFoundException('Creator profile not found');
    return creator;
  }

  async update(userId: string, dto: Partial<CreateCreatorDto>) {
    const creator = await this.prisma.creator.findUnique({ where: { userId } });
    if (!creator) throw new NotFoundException('Creator profile not found');

    return this.prisma.creator.update({
      where: { userId },
      data: {
        ...dto,
        platforms: dto.platforms ?? undefined,
      },
    });
  }

  async updateScores(
    creatorId: string,
    scores: {
      audienceScore?: number;
      fraudScore?: number;
      performanceScore?: number;
    },
  ) {
    return this.prisma.creator.update({
      where: { id: creatorId },
      data: scores,
    });
  }

  async getDashboardStats(creatorId: string) {
    const [deliverables, payments, contracts] = await Promise.all([
      this.prisma.deliverable.groupBy({
        by: ['status'],
        where: { creatorId },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: {
          contract: { creatorId },
          status: 'COMPLETED',
        },
        _sum: { netAmount: true },
      }),
      this.prisma.contract.count({ where: { creatorId, status: 'ACTIVE' } }),
    ]);

    return {
      deliverablesByStatus: deliverables,
      totalEarned: payments._sum.netAmount ?? 0,
      activeContracts: contracts,
    };
  }
}
