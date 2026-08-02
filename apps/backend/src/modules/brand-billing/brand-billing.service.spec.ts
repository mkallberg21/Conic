import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrandPlan, CampaignStatus, SubscriptionStatus } from '@prisma/client';
import { BrandBillingService } from './brand-billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

describe('BrandBillingService', () => {
  let service: BrandBillingService;
  const mockPrisma = {
    brand: { findUnique: jest.fn() },
    brandSubscription: { findUnique: jest.fn(), upsert: jest.fn() },
    campaign: { count: jest.fn() },
  };
  const flags: Record<string, unknown> = {};
  const mockConfig = { get: jest.fn((k: string) => flags[k]) };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandBillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(BrandBillingService);
    jest.clearAllMocks();
    for (const k of Object.keys(flags)) delete flags[k];
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_1' });
    mockPrisma.brandSubscription.upsert.mockResolvedValue({});
  });

  describe('getMyPlan', () => {
    it('defaults to FREE with entitlements + usage', async () => {
      mockPrisma.brandSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.campaign.count.mockResolvedValue(1);
      const r = await service.getMyPlan('b_user');
      expect(r.plan).toBe(BrandPlan.FREE);
      expect(r.entitlements.activeCampaigns).toBe(1);
      expect(r.usage.activeCampaigns).toBe(1);
    });
  });

  describe('startCheckout', () => {
    it('activates a paid plan immediately via the stub', async () => {
      const r = await service.startCheckout('b_user', BrandPlan.GROWTH);
      expect(r).toEqual({ activated: true, plan: BrandPlan.GROWTH });
      expect(mockPrisma.brandSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ plan: BrandPlan.GROWTH, status: SubscriptionStatus.ACTIVE }) }),
      );
    });

    it('returns a checkout URL for a live provider', async () => {
      flags['billing.provider'] = 'stripe';
      flags['billing.stripeSecretKey'] = 'sk_live';
      flags['billing.checkoutSuccessUrl'] = 'https://pay/ok';
      const r = await service.startCheckout('b_user', BrandPlan.STARTER);
      expect(r).toEqual({ activated: false, checkoutUrl: 'https://pay/ok' });
      expect(mockPrisma.brandSubscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('assertWithinCampaignLimit', () => {
    it('is log-only by default even when over the limit', async () => {
      mockPrisma.brandSubscription.findUnique.mockResolvedValue({ plan: BrandPlan.FREE });
      mockPrisma.campaign.count.mockResolvedValue(5); // FREE limit is 1
      await expect(service.assertWithinCampaignLimit('b_user')).resolves.toBeUndefined();
    });

    it('blocks over-limit when enforcement is on', async () => {
      flags['billing.enforceBrandLimits'] = true;
      mockPrisma.brandSubscription.findUnique.mockResolvedValue({ plan: BrandPlan.FREE });
      mockPrisma.campaign.count.mockResolvedValue(1);
      await expect(service.assertWithinCampaignLimit('b_user')).rejects.toThrow(ForbiddenException);
    });

    it('allows within a higher plan limit', async () => {
      flags['billing.enforceBrandLimits'] = true;
      mockPrisma.brandSubscription.findUnique.mockResolvedValue({ plan: BrandPlan.GROWTH });
      mockPrisma.campaign.count.mockResolvedValue(5); // GROWTH allows 20
      await expect(service.assertWithinCampaignLimit('b_user')).resolves.toBeUndefined();
      expect(mockPrisma.campaign.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ brandId: 'brand_1', status: CampaignStatus.ACTIVE }) }),
      );
    });
  });
});
