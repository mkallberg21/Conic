import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, firstName: true,
        lastName: true, avatarUrl: true, emailVerified: true,
        twoFactorEnabled: true, createdAt: true,
        brand: { select: { id: true, companyName: true } },
        creator: { select: { id: true, handle: true } },
        agency: { select: { id: true, name: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true, email: true, role: true, firstName: true,
        lastName: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivate(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
