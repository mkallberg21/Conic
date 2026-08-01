import {
  Injectable,
  UnauthorizedException,
  ConflictException,} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,   // 64 MiB — OWASP recommended
      timeCost: 3,
      parallelism: 4,
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        ...(dto.role === UserRole.BRAND && dto.companyName
          ? {
              brand: {
                create: {
                  companyName: dto.companyName,
                },
              },
            }
          : {}),
        ...(dto.role === UserRole.CREATOR && dto.handle
          ? {
              creator: {
                create: {
                  handle: dto.handle,
                  platforms: {},
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: delete old token before issuing new one (token theft prevention)
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
    );

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Logged out successfully' };
  }

  async googleOauthUser(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  }) {
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          role: 'BRAND' as const,
          passwordHash: '',   // OAuth users have no local password
          isActive: true,
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  /**
   * Returns items that demand immediate attention for the current user.
   * For CREATOR: contracts to sign, overdue deliverables, revision requests, pending payments.
   * For BRAND: deliverables awaiting review, unsigned contracts, disputed contracts.
   */
  async getActions(userId: string, role: string) {
    if (role === 'CREATOR') {
      const creator = await this.prisma.creator.findUnique({ where: { userId } });
      if (!creator) return { contractsToSign: [], deliverablesOverdue: [], revisionRequests: [], pendingPayments: [] };

      const now = new Date();
      const [contractsToSign, deliverablesOverdue, revisionRequests, pendingPayments] = await Promise.all([
        this.prisma.contract.findMany({
          where: { creatorId: creator.id, status: 'PENDING_SIGNATURE', creatorSignedAt: null },
          select: { id: true, title: true, totalValue: true, brand: { include: { user: { select: { firstName: true, lastName: true } } } } },
          take: 5,
        }),
        this.prisma.deliverable.findMany({
          where: { creatorId: creator.id, status: { in: ['PENDING', 'IN_PROGRESS'] }, dueDate: { lt: now } },
          select: { id: true, title: true, dueDate: true, platform: true, contract: { select: { id: true, title: true } } },
          take: 10,
          orderBy: { dueDate: 'asc' },
        }),
        this.prisma.deliverable.findMany({
          where: { creatorId: creator.id, status: 'REVISION_REQUESTED' },
          select: { id: true, title: true, rejectionReason: true, contract: { select: { id: true, title: true } } },
          take: 5,
        }),
        this.prisma.payment.findMany({
          where: { contract: { creatorId: creator.id }, status: 'PENDING' },
          select: { id: true, amount: true, currency: true, description: true, contract: { select: { id: true, title: true } } },
          take: 5,
        }),
      ]);

      return { contractsToSign, deliverablesOverdue, revisionRequests, pendingPayments };
    }

    if (role === 'BRAND') {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      if (!brand) return { pendingReview: [], contractsToSign: [], disputedContracts: [] };

      const [pendingReview, contractsToSign, disputedContracts] = await Promise.all([
        this.prisma.deliverable.findMany({
          where: { contract: { brandId: brand.id }, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
          select: { id: true, title: true, submittedAt: true, creator: { include: { user: { select: { firstName: true, lastName: true } } } }, contract: { select: { id: true, title: true } } },
          take: 10,
          orderBy: { submittedAt: 'asc' },
        }),
        this.prisma.contract.findMany({
          where: { brandId: brand.id, status: 'PENDING_SIGNATURE', brandSignedAt: null },
          select: { id: true, title: true, totalValue: true },
          take: 5,
        }),
        this.prisma.contract.findMany({
          where: { brandId: brand.id, status: 'DISPUTED' },
          select: { id: true, title: true, creator: { include: { user: { select: { firstName: true, lastName: true } } } } },
          take: 5,
        }),
      ]);

      return { pendingReview, contractsToSign, disputedContracts };
    }

    return {};
  }

  /**
   * SHA-256 the raw refresh token before storing/looking up.
   * If the refresh_tokens table is exfiltrated, raw tokens cannot be replayed.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const privateKey = this.configService.get<string>('jwt.privateKey');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

    // Access token: RS256 asymmetric — verifiable by any service with the public key
    const accessToken = await this.jwtService.signAsync(payload, {
      ...(privateKey
        ? { privateKey, algorithm: 'RS256' }
        : { secret: this.configService.get('jwt.secret') }),
      expiresIn: this.configService.get('jwt.expiresIn', '15m'),
    });

    // Refresh token: HS256 with its own secret — never leaves the auth service
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, type: 'refresh' },
      { secret: refreshSecret, expiresIn: this.configService.get('jwt.refreshExpiresIn', '7d') },
    );

    // Store SHA-256 hash of the refresh token (not the raw token)
    const expiresIn = 7 * 24 * 60 * 60 * 1000;
    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + expiresIn),
      },
    });

    return { accessToken, refreshToken };
  }
}
