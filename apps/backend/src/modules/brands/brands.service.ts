import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { contracts: true, campaigns: true } },
      },
    });
    if (!brand) throw new NotFoundException('Brand profile not found');
    return brand;
  }

  async findById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { contracts: true, campaigns: true } },
      },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async update(userId: string, dto: Partial<CreateBrandDto>) {
    const brand = await this.prisma.brand.findUnique({ where: { userId } });
    if (!brand) throw new NotFoundException('Brand profile not found');

    return this.prisma.brand.update({
      where: { userId },
      data: dto,
    });
  }

  async getDashboardStats(brandId: string) {
    const [contracts, campaigns, payments] = await Promise.all([
      this.prisma.contract.count({ where: { brandId } }),
      this.prisma.campaign.count({ where: { brandId } }),
      this.prisma.payment.aggregate({
        where: { contract: { brandId }, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalContracts: contracts,
      totalCampaigns: campaigns,
      totalSpent: payments._sum.amount ?? 0,
    };
  }
}
