import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_PAGE_SIZE = 100;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, firstName: true,
        lastName: true, avatarUrl: true, emailVerified: true,
        twoFactorEnabled: true, isActive: true, createdAt: true, lastLoginAt: true,
        brand: { select: { id: true, companyName: true, website: true, industry: true } },
        creator: { select: { id: true, handle: true, primaryPlatform: true, isVerified: true } },
        agency: { select: { id: true, name: true, website: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll(page = 1, take = 25) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, MAX_PAGE_SIZE);
    const limit = Math.min(Math.max(1, take), MAX_PAGE_SIZE);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: {
          id: true, email: true, role: true, firstName: true,
          lastName: true, isActive: true, createdAt: true, lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);

    return {
      items,
      total,
      page: Math.max(1, page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
  }

  async reactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, isActive: true },
    });
  }
}
