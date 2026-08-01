import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeliverableStatus, UserRole } from '@prisma/client';
import { DeliverablesService } from './deliverables.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  CreateDeliverableDto,
  SubmitDeliverableDto,
  ReviewDeliverableDto,
} from './dto/create-deliverable.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  contract: { findUnique: jest.fn() },
  brand: { findUnique: jest.fn() },
  creator: { findUnique: jest.fn() },
  deliverable: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
};

const mockEventBus = { emit: jest.fn() };
const mockAi = { verifyDeliverable: jest.fn().mockResolvedValue(undefined) };
const mockAudit = { log: jest.fn() };

const CREATOR_USER = 'user_creator';
const BRAND_USER = 'user_brand';

describe('DeliverablesService', () => {
  let service: DeliverablesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliverablesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: AiService, useValue: mockAi },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<DeliverablesService>(DeliverablesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = { contractId: 'c_1', title: 'Reel', platform: 'instagram', contentType: 'reel', dueDate: '2025-06-01' } as CreateDeliverableDto;

    it('rejects adding deliverables to a non-ACTIVE contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'c_1', status: 'DRAFT', brand: {}, creator: {} });
      await expect(service.create(BRAND_USER, UserRole.BRAND, dto)).rejects.toThrow(BadRequestException);
    });

    it('forbids a brand that does not own the contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'c_1', status: 'ACTIVE', brandId: 'brand_owner', creatorId: 'cr_1', brand: {}, creator: {} });
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_other' });
      await expect(service.create(BRAND_USER, UserRole.BRAND, dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submit', () => {
    const dto = { proofUrl: 'https://proof.example/x', proofType: 'url' } as SubmitDeliverableDto;

    it('forbids submitting a deliverable the creator does not own', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.deliverable.findUnique.mockResolvedValue({ id: 'd_1', creatorId: 'cr_other', status: DeliverableStatus.PENDING });
      await expect(service.submit('d_1', CREATOR_USER, dto)).rejects.toThrow(ForbiddenException);
    });

    it('rejects re-submitting an already-approved deliverable', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.deliverable.findUnique.mockResolvedValue({ id: 'd_1', creatorId: 'cr_1', status: DeliverableStatus.APPROVED });
      await expect(service.submit('d_1', CREATOR_USER, dto)).rejects.toThrow(BadRequestException);
    });

    it('marks SUBMITTED, emits DELIVERABLE_SUBMITTED, and kicks off async AI verification', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.deliverable.findUnique.mockResolvedValue({
        id: 'd_1', creatorId: 'cr_1', contractId: 'c_1', status: DeliverableStatus.PENDING, platform: 'instagram', contentType: 'reel',
      });
      mockPrisma.deliverable.update.mockResolvedValue({ id: 'd_1', status: DeliverableStatus.SUBMITTED });

      await service.submit('d_1', CREATOR_USER, dto);

      expect(mockPrisma.deliverable.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DeliverableStatus.SUBMITTED }) }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('deliverable.submitted', expect.objectContaining({ deliverableId: 'd_1' }));
      expect(mockAi.verifyDeliverable).toHaveBeenCalledWith('d_1', expect.any(Object));
    });
  });

  describe('review (payment trigger)', () => {
    const submitted = { id: 'd_1', contractId: 'c_1', status: DeliverableStatus.SUBMITTED, paymentAmount: 50_000, contract: { brandId: 'brand_1' } };

    beforeEach(() => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_1' });
      mockPrisma.deliverable.update.mockResolvedValue({ id: 'd_1' });
    });

    it('forbids a brand that does not own the contract', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_other' });
      mockPrisma.deliverable.findUnique.mockResolvedValue(submitted);
      await expect(
        service.review('d_1', BRAND_USER, { action: 'APPROVED' } as ReviewDeliverableDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects reviewing a deliverable that is not pending review', async () => {
      mockPrisma.deliverable.findUnique.mockResolvedValue({ ...submitted, status: DeliverableStatus.APPROVED });
      await expect(
        service.review('d_1', BRAND_USER, { action: 'APPROVED' } as ReviewDeliverableDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('APPROVED emits DELIVERABLE_APPROVED (the payment trigger)', async () => {
      mockPrisma.deliverable.findUnique.mockResolvedValue(submitted);

      await service.review('d_1', BRAND_USER, { action: 'APPROVED' } as ReviewDeliverableDto);

      expect(mockPrisma.deliverable.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DeliverableStatus.APPROVED }) }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'deliverable.approved',
        expect.objectContaining({ deliverableId: 'd_1', contractId: 'c_1', paymentAmount: 50_000 }),
      );
    });

    it('REJECTED does NOT emit the payment trigger', async () => {
      mockPrisma.deliverable.findUnique.mockResolvedValue(submitted);

      await service.review('d_1', BRAND_USER, { action: 'REJECTED', rejectionReason: 'off-brief' } as ReviewDeliverableDto);

      expect(mockPrisma.deliverable.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DeliverableStatus.REJECTED }) }),
      );
      expect(mockEventBus.emit).not.toHaveBeenCalledWith('deliverable.approved', expect.anything());
    });
  });
});
