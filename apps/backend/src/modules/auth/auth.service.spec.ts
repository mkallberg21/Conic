import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GuardianService } from '../guardian/guardian.service';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'usr_1',
  email: 'brand@test.com',
  passwordHash: '',
  role: UserRole.BRAND,
  firstName: 'Test',
  lastName: 'Brand',
  avatarUrl: null,
  emailVerified: false,
  isActive: true,
  twoFactorEnabled: false,
  createdAt: new Date(),
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  verifyAsync: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    const cfg: Record<string, string | number> = {
      'jwt.secret': 'test-secret',
      'jwt.expiresIn': '15m',
      'jwt.refreshSecret': 'test-refresh-secret',
      'jwt.refreshExpiresIn': '7d',
      'guardian.minorAgeThreshold': 18,
    };
    return cfg[key] ?? def;
  }),
};

const mockGuardian = { createInvite: jest.fn().mockResolvedValue({ inviteId: 'inv_1' }) };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: GuardianService, useValue: mockGuardian },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'brand@test.com',
          password: 'Password1!',
          role: UserRole.BRAND,
          firstName: 'Test',
          lastName: 'Brand',
          companyName: 'Acme',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and returns tokens on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, id: 'usr_new' });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token' });

      const result = await service.register({
        email: 'new@test.com',
        password: 'Password1!',
        role: UserRole.BRAND,
        firstName: 'New',
        lastName: 'User',
        companyName: 'NewCo',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('requires a guardian email for a minor influencer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const minorDob = new Date();
      minorDob.setFullYear(minorDob.getFullYear() - 15);

      await expect(
        service.register({
          email: 'kid@test.com',
          password: 'Password1!',
          role: UserRole.ATHLETE,
          firstName: 'Kid',
          lastName: 'Athlete',
          sport: 'Track',
          dateOfBirth: minorDob.toISOString(),
        }),
      ).rejects.toThrow(/parent or guardian/i);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('creates a guardian invite when a minor supplies a guardian email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser, id: 'usr_kid', role: UserRole.ATHLETE, athlete: { id: 'ath_1' }, creator: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'r' });
      const minorDob = new Date();
      minorDob.setFullYear(minorDob.getFullYear() - 15);

      const result = await service.register({
        email: 'kid@test.com',
        password: 'Password1!',
        role: UserRole.ATHLETE,
        firstName: 'Kid',
        lastName: 'Athlete',
        sport: 'Track',
        dateOfBirth: minorDob.toISOString(),
        guardianEmail: 'parent@test.com',
      });

      expect(result.guardianRequired).toBe(true);
      expect(result.verificationRequired).toBe(true);
      expect(mockGuardian.createInvite).toHaveBeenCalledWith(
        expect.objectContaining({ subject: { athleteId: 'ath_1' }, guardianEmail: 'parent@test.com' }),
      );
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@test.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await argon2.hash('correct-password');
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({ email: 'brand@test.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens on correct credentials', async () => {
      const hash = await argon2.hash('correct-password');
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh' });

      const result = await service.login({ email: 'brand@test.com', password: 'correct-password' });
      expect(result.accessToken).toBe('mock-jwt-token');
    });
  });
});
