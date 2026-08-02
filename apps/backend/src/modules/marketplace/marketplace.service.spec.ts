import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ApplicationStatus, BriefStatus, Prisma, UserRole } from '@prisma/client';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApplyDto, CreateBriefDto } from './dto/marketplace.dto';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  const mockPrisma = {
    brand: { findUnique: jest.fn() },
    creator: { findUnique: jest.fn() },
    athlete: { findUnique: jest.fn() },
    marketplaceBrief: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    briefApplication: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(MarketplaceService);
    jest.clearAllMocks();
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_1' });
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
  });

  describe('createBrief', () => {
    it('creates an open brief for the brand', async () => {
      mockPrisma.marketplaceBrief.create.mockResolvedValue({ id: 'b1' });
      await service.createBrief('brand_user', { title: 'Reel', description: 'Make a reel', budgetCents: 50000 } as CreateBriefDto);
      expect(mockPrisma.marketplaceBrief.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ brandId: 'brand_1', budgetCents: 50000, targetType: 'both' }) }),
      );
    });
  });

  describe('apply', () => {
    it('lets a creator apply to an open brief', async () => {
      mockPrisma.marketplaceBrief.findUnique.mockResolvedValue({ id: 'b1', status: BriefStatus.OPEN, targetType: 'both' });
      mockPrisma.briefApplication.create.mockResolvedValue({ id: 'app1' });
      await service.apply('u1', UserRole.CREATOR, 'b1', { pitch: 'I make great reels' } as ApplyDto);
      expect(mockPrisma.briefApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ briefId: 'b1', creatorId: 'cr_1', athleteId: null }) }),
      );
    });

    it('rejects applying to a closed brief', async () => {
      mockPrisma.marketplaceBrief.findUnique.mockResolvedValue({ id: 'b1', status: BriefStatus.CLOSED, targetType: 'both' });
      await expect(service.apply('u1', UserRole.CREATOR, 'b1', { pitch: 'x' } as ApplyDto)).rejects.toThrow(BadRequestException);
    });

    it('blocks a creator from an athlete-only brief', async () => {
      mockPrisma.marketplaceBrief.findUnique.mockResolvedValue({ id: 'b1', status: BriefStatus.OPEN, targetType: 'athlete' });
      await expect(service.apply('u1', UserRole.CREATOR, 'b1', { pitch: 'x' } as ApplyDto)).rejects.toThrow(ForbiddenException);
    });

    it('surfaces a friendly error on duplicate application', async () => {
      mockPrisma.marketplaceBrief.findUnique.mockResolvedValue({ id: 'b1', status: BriefStatus.OPEN, targetType: 'both' });
      mockPrisma.briefApplication.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '6' }));
      await expect(service.apply('u1', UserRole.CREATOR, 'b1', { pitch: 'x' } as ApplyDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('respondToApplication', () => {
    it('accepting an applicant marks the brief FILLED', async () => {
      mockPrisma.briefApplication.findUnique.mockResolvedValue({ id: 'app1', briefId: 'b1', status: ApplicationStatus.PENDING, brief: { brandId: 'brand_1' } });
      mockPrisma.briefApplication.update.mockResolvedValue({ id: 'app1', status: ApplicationStatus.ACCEPTED });
      await service.respondToApplication('brand_user', 'app1', { decision: 'ACCEPTED' });
      expect(mockPrisma.marketplaceBrief.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1' }, data: { status: BriefStatus.FILLED } }),
      );
    });
  });

  describe('browseBriefs', () => {
    it('returns open briefs targeted at the creator, tagged with application status', async () => {
      mockPrisma.marketplaceBrief.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
      mockPrisma.briefApplication.findMany.mockResolvedValue([{ briefId: 'b1', status: ApplicationStatus.PENDING }]);
      const r = await service.browseBriefs('u1', UserRole.CREATOR);
      expect(r.find((b) => b.id === 'b1')?.myApplicationStatus).toBe(ApplicationStatus.PENDING);
      expect(r.find((b) => b.id === 'b2')?.myApplicationStatus).toBeNull();
    });
  });
});
