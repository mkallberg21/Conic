import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstitutionPlan, SubscriptionStatus, UserRole } from '@prisma/client';
import { SchoolBillingService } from './school-billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

describe('SchoolBillingService', () => {
  let service: SchoolBillingService;
  const mockPrisma = {
    complianceOfficer: { findUnique: jest.fn() },
    university: { findUnique: jest.fn() },
    schoolSubscription: { findUnique: jest.fn(), upsert: jest.fn() },
    athlete: { count: jest.fn() },
    nilDeal: { count: jest.fn() },
    nilDisclosure: { groupBy: jest.fn(), findMany: jest.fn() },
  };
  const flags: Record<string, unknown> = {};
  const mockConfig = { get: jest.fn((k: string) => flags[k]) };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolBillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(SchoolBillingService);
    jest.clearAllMocks();
    for (const k of Object.keys(flags)) delete flags[k];
    mockPrisma.university.findUnique.mockResolvedValue({ id: 'uni_1' });
    mockPrisma.schoolSubscription.upsert.mockResolvedValue({});
  });

  describe('assertAccess', () => {
    it('lets an admin access any institution', async () => {
      await expect(service.assertAccess('u', UserRole.ADMIN, 'uni_1')).resolves.toBeUndefined();
    });

    it('blocks a compliance officer from another institution', async () => {
      mockPrisma.complianceOfficer.findUnique.mockResolvedValue({ universityId: 'other' });
      await expect(service.assertAccess('u', UserRole.COMPLIANCE_OFFICER, 'uni_1')).rejects.toThrow(ForbiddenException);
    });

    it('allows a compliance officer at their own institution', async () => {
      mockPrisma.complianceOfficer.findUnique.mockResolvedValue({ universityId: 'uni_1' });
      await expect(service.assertAccess('u', UserRole.COMPLIANCE_OFFICER, 'uni_1')).resolves.toBeUndefined();
    });

    it('rejects unrelated roles', async () => {
      await expect(service.assertAccess('u', UserRole.BRAND, 'uni_1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPlan', () => {
    it('defaults to NONE with entitlements + roster usage', async () => {
      mockPrisma.schoolSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.athlete.count.mockResolvedValue(42);
      const r = await service.getPlan('uni_1');
      expect(r.plan).toBe(InstitutionPlan.NONE);
      expect(r.usage.athletes).toBe(42);
      expect(r.catalog[InstitutionPlan.ENTERPRISE].prioritySupport).toBe(true);
    });
  });

  describe('startCheckout', () => {
    it('activates a paid plan immediately via the stub', async () => {
      const r = await service.startCheckout('uni_1', InstitutionPlan.DEPARTMENT);
      expect(r).toEqual({ activated: true, plan: InstitutionPlan.DEPARTMENT });
      expect(mockPrisma.schoolSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: InstitutionPlan.DEPARTMENT, status: SubscriptionStatus.ACTIVE }),
        }),
      );
    });

    it('returns a checkout URL for a live provider', async () => {
      flags['billing.provider'] = 'stripe';
      flags['billing.stripeSecretKey'] = 'sk_live';
      flags['billing.checkoutSuccessUrl'] = 'https://pay/ok';
      const r = await service.startCheckout('uni_1', InstitutionPlan.CAMPUS);
      expect(r).toEqual({ activated: false, checkoutUrl: 'https://pay/ok' });
      expect(mockPrisma.schoolSubscription.upsert).not.toHaveBeenCalled();
    });

    it('throws if the university does not exist', async () => {
      mockPrisma.university.findUnique.mockResolvedValue(null);
      await expect(service.startCheckout('ghost', InstitutionPlan.CAMPUS)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getComplianceOverview', () => {
    it('aggregates athletes, deals, and the disclosure compliance rate', async () => {
      mockPrisma.athlete.count.mockResolvedValue(30);
      mockPrisma.nilDeal.count
        .mockResolvedValueOnce(12) // active/pending deals
        .mockResolvedValueOnce(2); // flagged (high risk)
      mockPrisma.nilDisclosure.groupBy.mockResolvedValue([
        { status: 'APPROVED', _count: { _all: 8 } },
        { status: 'PENDING_REVIEW', _count: { _all: 2 } },
      ]);
      mockPrisma.nilDisclosure.findMany.mockResolvedValue([
        {
          id: 'd1', brandName: 'Nike', dealType: 'SOCIAL', status: 'APPROVED', createdAt: new Date(),
          athlete: { user: { firstName: 'Jane', lastName: 'Doe' } },
        },
      ]);

      const r = await service.getComplianceOverview('uni_1');
      expect(r.athletes).toBe(30);
      expect(r.activeDeals).toBe(12);
      expect(r.flaggedDeals).toBe(2);
      expect(r.disclosures).toEqual({ total: 10, pending: 2, approved: 8, complianceRate: 80 });
      expect(r.recent[0].athlete).toBe('Jane Doe');
    });

    it('reports 100% compliance when there are no disclosures', async () => {
      mockPrisma.athlete.count.mockResolvedValue(0);
      mockPrisma.nilDeal.count.mockResolvedValue(0);
      mockPrisma.nilDisclosure.groupBy.mockResolvedValue([]);
      mockPrisma.nilDisclosure.findMany.mockResolvedValue([]);
      const r = await service.getComplianceOverview('uni_1');
      expect(r.disclosures.complianceRate).toBe(100);
    });
  });
});
