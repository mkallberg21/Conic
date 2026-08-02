import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EscrowStatus, UserRole } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EscrowProvider } from './escrow.provider';

describe('EscrowService', () => {
  let service: EscrowService;
  const mockPrisma = {
    brand: { findUnique: jest.fn() },
    contract: { findUnique: jest.fn() },
    escrow: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  };
  const mockProvider = {
    name: 'stub', isLive: false,
    hold: jest.fn().mockResolvedValue({ ok: true, providerRef: 'esc_1' }),
    release: jest.fn().mockResolvedValue({ ok: true }),
    refund: jest.fn().mockResolvedValue({ ok: true }),
  };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EscrowProvider, useValue: mockProvider },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(EscrowService);
    jest.clearAllMocks();
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_1' });
    mockPrisma.contract.findUnique.mockResolvedValue({ id: 'c1', brandId: 'brand_1', totalValue: 50000, currency: 'USD' });
  });

  describe('fund', () => {
    it('holds funds and marks escrow FUNDED', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue(null);
      mockPrisma.escrow.upsert.mockResolvedValue({ id: 'e1', status: EscrowStatus.FUNDED });
      await service.fund('brand_user', 'c1');
      expect(mockProvider.hold).toHaveBeenCalledWith(50000, 'brand_1');
      expect(mockPrisma.escrow.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ status: EscrowStatus.FUNDED, amountCents: 50000 }) }),
      );
    });

    it('refuses to re-fund an already-funded escrow', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: EscrowStatus.FUNDED });
      await expect(service.fund('brand_user', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a contract the brand does not own', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'c1', brandId: 'other', totalValue: 1, currency: 'USD' });
      await expect(service.fund('brand_user', 'c1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('release', () => {
    it('releases a funded escrow to the creator', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: EscrowStatus.FUNDED, providerRef: 'esc_1' });
      mockPrisma.escrow.update.mockResolvedValue({ id: 'e1', status: EscrowStatus.RELEASED });
      await service.release('brand_user', 'c1');
      expect(mockProvider.release).toHaveBeenCalledWith('esc_1');
      expect(mockPrisma.escrow.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: EscrowStatus.RELEASED }) }),
      );
    });

    it('cannot release before funding', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: EscrowStatus.PENDING_FUNDING });
      await expect(service.release('brand_user', 'c1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getForContract', () => {
    it('lets the creator party see escrow status', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 'c1', totalValue: 50000, brand: { userId: 'brand_user' }, creator: { userId: 'creator_user' },
      });
      mockPrisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: EscrowStatus.FUNDED });
      const r = await service.getForContract('creator_user', UserRole.CREATOR, 'c1');
      expect(r.escrow?.status).toBe(EscrowStatus.FUNDED);
    });

    it('forbids a non-party', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 'c1', totalValue: 1, brand: { userId: 'brand_user' }, creator: { userId: 'creator_user' },
      });
      await expect(service.getForContract('stranger', UserRole.CREATOR, 'c1')).rejects.toThrow(ForbiddenException);
    });
  });
});
