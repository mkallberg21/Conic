import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { EngagementService } from './engagement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveProfileDto } from './dto/engagement.dto';

describe('EngagementService', () => {
  let service: EngagementService;
  const mockPrisma = {
    brand: { findUnique: jest.fn(), findMany: jest.fn() },
    creator: { findUnique: jest.fn() },
    athlete: { findUnique: jest.fn() },
    profileView: { findFirst: jest.fn(), create: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    savedProfile: { upsert: jest.fn(), deleteMany: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(EngagementService);
    jest.clearAllMocks();
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_1' });
  });

  describe('recordView', () => {
    it('records a new view', async () => {
      mockPrisma.profileView.findFirst.mockResolvedValue(null);
      mockPrisma.profileView.create.mockResolvedValue({ id: 'v1' });
      const r = await service.recordView('brand_user', 'creator', 'cr_1');
      expect(r).toEqual({ recorded: true });
      expect(mockPrisma.profileView.create).toHaveBeenCalledWith({ data: { brandId: 'brand_1', creatorId: 'cr_1' } });
    });

    it('dedupes a repeat view within 24h', async () => {
      mockPrisma.profileView.findFirst.mockResolvedValue({ id: 'v0' });
      const r = await service.recordView('brand_user', 'athlete', 'ath_1');
      expect(r).toEqual({ recorded: false, deduped: true });
      expect(mockPrisma.profileView.create).not.toHaveBeenCalled();
    });
  });

  describe('getMyInsights', () => {
    it('aggregates views, weekly views, unique brands and saves for a creator', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.profileView.count.mockResolvedValueOnce(42).mockResolvedValueOnce(7);
      mockPrisma.profileView.groupBy.mockResolvedValue([{ brandId: 'b1' }, { brandId: 'b2' }, { brandId: 'b3' }]);
      mockPrisma.savedProfile.count.mockResolvedValue(5);

      const r = await service.getMyInsights('u1', UserRole.CREATOR);

      expect(r).toEqual({ profileViews: 42, viewsThisWeek: 7, uniqueBrands: 3, savedByBrands: 5 });
    });

    it('rejects non-influencer roles', async () => {
      await expect(service.getMyInsights('u1', UserRole.BRAND)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyViewers', () => {
    it('returns the brands that viewed, with counts + saved flag (free for all)', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.profileView.groupBy.mockResolvedValue([
        { brandId: 'b1', _count: { _all: 3 }, _max: { createdAt: new Date('2026-08-01') } },
      ]);
      mockPrisma.savedProfile.findMany.mockResolvedValue([{ brandId: 'b1', createdAt: new Date() }]);
      mockPrisma.brand.findMany.mockResolvedValue([{ id: 'b1', companyName: 'Acme', logoUrl: null, industry: 'Retail' }]);

      const r = await service.getMyViewers('u1', UserRole.CREATOR);

      expect(r.viewers).toHaveLength(1);
      expect(r.viewers[0]).toMatchObject({ brandId: 'b1', companyName: 'Acme', views: 3, saved: true });
    });
  });

  describe('saveProfile', () => {
    it('upserts a saved creator by the composite unique key', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.savedProfile.upsert.mockResolvedValue({ id: 's1' });
      await service.saveProfile('brand_user', { targetType: 'creator', targetId: 'cr_1', note: 'great fit' } as SaveProfileDto);
      expect(mockPrisma.savedProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { brandId_creatorId: { brandId: 'brand_1', creatorId: 'cr_1' } } }),
      );
    });
  });

  describe('listSaved', () => {
    it('flattens creators and athletes to a uniform map-ready shape', async () => {
      mockPrisma.savedProfile.findMany.mockResolvedValue([
        {
          id: 's1', campaignId: null, note: null, createdAt: new Date(),
          creator: { id: 'cr_1', handle: 'jane', city: 'Austin', region: 'TX', country: 'US', approxLat: 30.3, approxLng: -97.7, followersCount: 1000, performanceScore: 80, user: { firstName: 'Jane', lastName: 'Doe', avatarUrl: null } },
          athlete: null,
        },
      ]);
      const r = await service.listSaved('brand_user');
      expect(r[0]).toMatchObject({
        targetType: 'creator', targetId: 'cr_1', name: 'Jane Doe',
        location: 'Austin, TX', approxLat: 30.3, approxLng: -97.7, subtitle: '@jane',
      });
    });
  });
});
