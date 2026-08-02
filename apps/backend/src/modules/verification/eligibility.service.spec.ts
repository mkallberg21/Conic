import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgeCheckMethod, KybTier } from '@prisma/client';
import { EligibilityService } from './eligibility.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EligibilityService', () => {
  let service: EligibilityService;
  const mockPrisma = { user: { findUnique: jest.fn() }, brand: { findUnique: jest.fn() } };
  const flags: Record<string, boolean> = {};
  const mockConfig = { get: jest.fn((k: string) => flags[k]) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EligibilityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(EligibilityService);
    jest.clearAllMocks();
    for (const k of Object.keys(flags)) delete flags[k];
  });

  describe('assertCanSignAgreement (age gate)', () => {
    it('is log-only (passes) when the enforcement flag is off', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ageVerified: false, ageAssurance: null });
      await expect(service.assertCanSignAgreement('u1')).resolves.toBeUndefined();
    });

    it('throws once enforcement is switched on and age is unverified', async () => {
      flags['verification.enforceAgeToSign'] = true;
      mockPrisma.user.findUnique.mockResolvedValue({ ageVerified: false, ageAssurance: null });
      await expect(service.assertCanSignAgreement('u1')).rejects.toThrow(ForbiddenException);
    });

    it('passes when age is verified regardless of flag', async () => {
      flags['verification.enforceAgeToSign'] = true;
      mockPrisma.user.findUnique.mockResolvedValue({ ageVerified: true, ageAssurance: AgeCheckMethod.ESTIMATION });
      await expect(service.assertCanSignAgreement('u1')).resolves.toBeUndefined();
    });
  });

  describe('assertCanReceivePayout', () => {
    it('requires DOCUMENT-grade verification when enforced', async () => {
      flags['verification.enforceAgeToPayout'] = true;
      mockPrisma.user.findUnique.mockResolvedValue({ ageVerified: true, ageAssurance: AgeCheckMethod.ESTIMATION });
      await expect(service.assertCanReceivePayout('u1')).rejects.toThrow(ForbiddenException);
    });

    it('passes with DOCUMENT-grade verification', async () => {
      flags['verification.enforceAgeToPayout'] = true;
      mockPrisma.user.findUnique.mockResolvedValue({ ageVerified: true, ageAssurance: AgeCheckMethod.DOCUMENT });
      await expect(service.assertCanReceivePayout('u1')).resolves.toBeUndefined();
    });
  });

  describe('assertBrandCanContactMinor (defaults ON)', () => {
    it('blocks a brand below ENHANCED tier by default', async () => {
      // Config defaults this gate ON (ENFORCE_KYB_MINORS !== 'false').
      flags['verification.enforceKybToContactMinors'] = true;
      mockPrisma.brand.findUnique.mockResolvedValue({ kybTier: KybTier.BASIC, kybStatus: 'APPROVED' });
      await expect(service.assertBrandCanContactMinor('b1')).rejects.toThrow(ForbiddenException);
    });

    it('allows an ENHANCED-tier brand', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ kybTier: KybTier.ENHANCED, kybStatus: 'APPROVED' });
      await expect(service.assertBrandCanContactMinor('b1')).resolves.toBeUndefined();
    });
  });

  describe('assertBrandCanTransact', () => {
    it('is log-only by default for an unverified brand', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ kybTier: KybTier.NONE, kybStatus: 'NOT_STARTED' });
      await expect(service.assertBrandCanTransact('b1')).resolves.toBeUndefined();
    });

    it('blocks an unverified brand once enforced', async () => {
      flags['verification.enforceKybToTransact'] = true;
      mockPrisma.brand.findUnique.mockResolvedValue({ kybTier: KybTier.NONE, kybStatus: 'NOT_STARTED' });
      await expect(service.assertBrandCanTransact('b1')).rejects.toThrow(ForbiddenException);
    });
  });
});
