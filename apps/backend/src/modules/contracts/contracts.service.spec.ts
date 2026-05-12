import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ContractStatus, UserRole } from '@prisma/client';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../../common/audit/audit.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  brand: { findUnique: jest.fn() },
  creator: { findUnique: jest.fn() },
  contract: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockEventBus = { emit: jest.fn() };
const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockAi = {
  generateContractContent: jest.fn().mockResolvedValue({
    content: '# Test Contract',
    riskScore: 20,
    riskFlags: [],
    clauses: [],
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContractsService', () => {
  let service: ContractsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: AiService, useValue: mockAi },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws ForbiddenException when brand profile missing', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(
        service.create('usr_no_brand', {
          creatorId: 'cr_1',
          title: 'Test',
          platforms: ['instagram'],
          totalValue: 50000,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when creator not found', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.creator.findUnique.mockResolvedValue(null);

      await expect(
        service.create('usr_brand', {
          creatorId: 'cr_missing',
          title: 'Test',
          platforms: ['instagram'],
          totalValue: 50000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates contract, calls AI and emits event', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.contract.create.mockResolvedValue({
        id: 'con_1',
        brandId: 'br_1',
        creatorId: 'cr_1',
        status: ContractStatus.DRAFT,
        brand: { user: { firstName: 'Brand', lastName: 'User', email: 'b@t.com' } },
        creator: { user: { firstName: 'Creator', lastName: 'User', email: 'c@t.com' } },
        milestones: [],
      });

      await service.create('usr_brand', {
        creatorId: 'cr_1',
        title: 'Instagram Campaign',
        platforms: ['instagram'],
        totalValue: 100000,
      });

      expect(mockAi.generateContractContent).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith('contract.created', expect.any(Object));
    });
  });

  describe('sign', () => {
    const mockContract = {
      id: 'con_1',
      status: ContractStatus.PENDING_SIGNATURE,
      brandId: 'br_1',
      creatorId: 'cr_1',
      brand: { userId: 'usr_brand', user: { firstName: 'B', email: 'b@t.com' } },
      creator: { userId: 'usr_creator', user: { firstName: 'C', email: 'c@t.com' } },
      brandSignedAt: null,
      creatorSignedAt: null,
    };

    it('throws ForbiddenException when user not party to contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);

      await expect(
        service.sign('con_1', 'usr_unrelated', '1.2.3.4'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows brand to sign', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.contract.update.mockResolvedValue({
        ...mockContract,
        brandSignedAt: new Date(),
        status: ContractStatus.PENDING_SIGNATURE,
      });

      const result = await service.sign('con_1', 'usr_brand', '1.2.3.4');
      expect(mockPrisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ brandSignedAt: expect.any(Date) }),
        }),
      );
      expect(result).toBeDefined();
    });
  });
});
