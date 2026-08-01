import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { TwoFactorService } from './two-factor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { SmsService } from '../../common/sms/sms.service';
import { AuditService } from '../../common/audit/audit.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    verificationCode: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };
  const mockEmail = { sendVerificationCode: jest.fn().mockResolvedValue(undefined) };
  const mockSms = { send: jest.fn().mockResolvedValue(undefined), isLive: false };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
        { provide: SmsService, useValue: mockSms },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(TwoFactorService);
    jest.clearAllMocks();
    mockPrisma.verificationCode.findFirst.mockResolvedValue(null);
    mockPrisma.verificationCode.create.mockResolvedValue({ id: 'vc_1' });
    mockPrisma.verificationCode.updateMany.mockResolvedValue({ count: 0 });
  });

  describe('getStatus', () => {
    it('requires both email+phone for an influencer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com', phone: null, emailVerified: true, phoneVerified: false, role: UserRole.CREATOR,
      });
      const s = await service.getStatus('u1');
      expect(s.required).toBe(true);
      expect(s.fullyVerified).toBe(false);
    });

    it('treats non-influencers as fully verified (unconstrained)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com', phone: null, emailVerified: false, phoneVerified: false, role: UserRole.BRAND,
      });
      const s = await service.getStatus('u1');
      expect(s.required).toBe(false);
      expect(s.fullyVerified).toBe(true);
    });
  });

  describe('requestEmailCode', () => {
    it('issues and emails a code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'jane@x.com', firstName: 'Jane', emailVerified: false });
      const r = await service.requestEmailCode('u1');
      expect(r).toMatchObject({ sent: true, channel: 'EMAIL' });
      expect(mockPrisma.verificationCode.create).toHaveBeenCalled();
      expect(mockEmail.sendVerificationCode).toHaveBeenCalledWith('jane@x.com', expect.stringMatching(/^\d{6}$/), 'Jane');
    });

    it('short-circuits when email already verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'jane@x.com', firstName: 'Jane', emailVerified: true });
      const r = await service.requestEmailCode('u1');
      expect(r).toEqual({ alreadyVerified: true, channel: 'EMAIL' });
      expect(mockEmail.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('enforces a resend cooldown', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'jane@x.com', firstName: 'Jane', emailVerified: false });
      mockPrisma.verificationCode.findFirst.mockResolvedValue({ id: 'vc_0', createdAt: new Date() });
      await expect(service.requestEmailCode('u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmailCode', () => {
    it('rejects an incorrect code and increments attempts', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'vc_1', codeHash: sha256('111111'), attempts: 0, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
      });
      await expect(service.verifyEmailCode('u1', '999999')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.verificationCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { attempts: { increment: 1 } } }),
      );
    });

    it('accepts the correct code and marks email verified', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'vc_1', codeHash: sha256('123456'), attempts: 0, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com', phone: '+1', emailVerified: true, phoneVerified: false, role: UserRole.CREATOR,
      });
      await service.verifyEmailCode('u1', '123456');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { emailVerified: true } });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EMAIL_VERIFIED' }));
    });

    it('rejects an expired code', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'vc_1', codeHash: sha256('123456'), attempts: 0, expiresAt: new Date(Date.now() - 1000), consumedAt: null,
      });
      await expect(service.verifyEmailCode('u1', '123456')).rejects.toThrow(/expired/i);
    });
  });

  describe('requestPhoneCode', () => {
    it('normalizes + persists the phone and sends an SMS', async () => {
      const r = await service.requestPhoneCode('u1', '(415) 555-0123');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { phone: '+4155550123', phoneVerified: false } }),
      );
      expect(mockSms.send).toHaveBeenCalledWith('+4155550123', expect.stringContaining('verification code'));
      expect(r).toMatchObject({ sent: true, channel: 'PHONE', delivered: false });
    });

    it('rejects an implausible phone number', async () => {
      await expect(service.requestPhoneCode('u1', '123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('assertInfluencerVerified', () => {
    it('throws for an influencer missing phone verification', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.ATHLETE, emailVerified: true, phoneVerified: false });
      await expect(service.assertInfluencerVerified('u1')).rejects.toThrow(ForbiddenException);
    });

    it('passes for a fully verified influencer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.CREATOR, emailVerified: true, phoneVerified: true });
      await expect(service.assertInfluencerVerified('u1')).resolves.toBeUndefined();
    });

    it('is a no-op for non-influencers', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.BRAND, emailVerified: false, phoneVerified: false });
      await expect(service.assertInfluencerVerified('u1')).resolves.toBeUndefined();
    });
  });
});
