import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatorPlan, SubscriptionStatus } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { BillingProvider } from './billing.provider';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  const mockPrisma = {
    subscription: { findUnique: jest.fn(), upsert: jest.fn() },
    creator: { updateMany: jest.fn() },
    athlete: { updateMany: jest.fn() },
  };
  const mockBilling = { name: 'stub', isLive: false, createCheckout: jest.fn(), parseWebhook: jest.fn() };
  const mockAudit = { log: jest.fn() };
  const mockConfig = { get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingProvider, useValue: mockBilling },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(SubscriptionService);
    jest.clearAllMocks();
    mockPrisma.subscription.upsert.mockResolvedValue({});
    mockPrisma.creator.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.athlete.updateMany.mockResolvedValue({ count: 0 });
  });

  describe('getMyPlan', () => {
    it('defaults to FREE / not-pro when there is no subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const r = await service.getMyPlan('u1');
      expect(r).toMatchObject({ plan: CreatorPlan.FREE, isPro: false });
    });

    it('reports Pro for an active PRO subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: CreatorPlan.PRO, status: SubscriptionStatus.ACTIVE, dmCredits: 0 });
      const r = await service.getMyPlan('u1');
      expect(r.isPro).toBe(true);
    });
  });

  describe('startCheckout', () => {
    it('activates immediately via the stub and flips isPro on the profile', async () => {
      mockBilling.createCheckout.mockResolvedValue({ activated: true, providerSubscriptionId: 'sub_1' });
      const r = await service.startCheckout('u1', CreatorPlan.PRO);
      expect(r).toEqual({ activated: true, plan: CreatorPlan.PRO });
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ plan: CreatorPlan.PRO, dmCredits: 0 }) }),
      );
      expect(mockPrisma.creator.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isPro: true } }));
    });

    it('returns a checkout URL for a live provider (no auto-activate)', async () => {
      mockBilling.createCheckout.mockResolvedValue({ activated: false, checkoutUrl: 'https://pay/x' });
      const r = await service.startCheckout('u1', CreatorPlan.PRO);
      expect(r).toEqual({ activated: false, checkoutUrl: 'https://pay/x' });
      expect(mockPrisma.creator.updateMany).not.toHaveBeenCalled();
    });

    it('grants DM credits on PRO_PLUS', async () => {
      mockBilling.createCheckout.mockResolvedValue({ activated: true, providerSubscriptionId: 'sub_2' });
      await service.startCheckout('u1', CreatorPlan.PRO_PLUS);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ plan: CreatorPlan.PRO_PLUS, dmCredits: 20 }) }),
      );
    });
  });

  describe('assertPro', () => {
    it('throws for a free user', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: CreatorPlan.FREE, status: SubscriptionStatus.ACTIVE });
      await expect(service.assertPro('u1')).rejects.toThrow(ForbiddenException);
    });

    it('passes for an active Pro user', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: CreatorPlan.PRO, status: SubscriptionStatus.ACTIVE });
      await expect(service.assertPro('u1')).resolves.toBeUndefined();
    });

    it('treats a canceled Pro as not Pro', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: CreatorPlan.PRO, status: SubscriptionStatus.CANCELED });
      await expect(service.assertPro('u1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('returns the profile to Free and clears isPro', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: CreatorPlan.FREE, status: SubscriptionStatus.CANCELED, dmCredits: 0 });
      await service.cancel('u1');
      expect(mockPrisma.creator.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isPro: false } }));
    });
  });
});
