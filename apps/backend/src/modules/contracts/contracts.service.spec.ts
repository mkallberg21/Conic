import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../../common/audit/audit.service';
import { GuardianService } from '../guardian/guardian.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { EligibilityService } from '../verification/eligibility.service';

const ContractStatus = {
  DRAFT: 'DRAFT',
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  ACTIVE: 'ACTIVE',
} as const;

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreatedContract = {
  id: 'con_1',
  brandId: 'br_1',
  creatorId: 'cr_1',
  status: ContractStatus.DRAFT,
  brand: { user: { firstName: 'Brand', lastName: 'User', email: 'b@t.com' } },
  creator: { user: { firstName: 'Creator', lastName: 'User', email: 'c@t.com' } },
  milestones: [],
};

const mockTxClient = {
  contract: {
    create: jest.fn().mockResolvedValue(mockCreatedContract),
  },
};

const mockPrisma = {
  brand: { findUnique: jest.fn() },
  creator: { findUnique: jest.fn() },
  contract: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  // Simulate interactive transaction
  $transaction: jest.fn().mockImplementation(async (fn) => {
    if (typeof fn === 'function') return fn(mockTxClient);
    // Batch transaction: execute array passthrough
    return Promise.all(fn);
  }),
};

const mockEventBus = { emit: jest.fn() };
const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockGuardian = {
  requestApproval: jest.fn().mockResolvedValue([]),
  isApproved: jest.fn().mockResolvedValue(true),
};
const mockTwoFactor = { assertInfluencerVerified: jest.fn().mockResolvedValue(undefined) };
const mockEligibility = {
  assertBrandCanTransact: jest.fn().mockResolvedValue(undefined),
  assertBrandCanContactMinor: jest.fn().mockResolvedValue(undefined),
  assertCanSignAgreement: jest.fn().mockResolvedValue(undefined),
};
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
        { provide: GuardianService, useValue: mockGuardian },
        { provide: TwoFactorService, useValue: mockTwoFactor },
        { provide: EligibilityService, useValue: mockEligibility },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    jest.resetAllMocks();

    // Reset defaults
    mockTxClient.contract.create.mockResolvedValue(mockCreatedContract);
    mockAi.generateContractContent.mockResolvedValue({
      content: '# Test Contract',
      riskScore: 20,
      riskFlags: [],
      clauses: [],
    });
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(mockTxClient);
      return Promise.all(fn);
    });
  });

  describe('create', () => {
    it('throws ForbiddenException when brand profile missing', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });

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

    it('creates contract inside a prisma transaction', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });

      await service.create('usr_brand', {
        creatorId: 'cr_1',
        title: 'Instagram Campaign',
        platforms: ['instagram'],
        totalValue: 100000,
      });

      // Contract must be created inside the transaction, not on the outer client
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTxClient.contract.create).toHaveBeenCalledTimes(1);
    });

    it('calls AI before opening the database transaction', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });

      const callOrder: string[] = [];
      mockAi.generateContractContent.mockImplementation(async () => {
        callOrder.push('ai');
        return { content: '#Contract', riskScore: 10, riskFlags: [] };
      });
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        callOrder.push('transaction');
        return fn(mockTxClient);
      });

      await service.create('usr_brand', {
        creatorId: 'cr_1',
        title: 'Test',
        platforms: ['instagram'],
        totalValue: 100000,
      });

      expect(callOrder).toEqual(['ai', 'transaction']);
    });

    it('emits contract.created event after successful creation', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });

      await service.create('usr_brand', {
        creatorId: 'cr_1',
        title: 'Instagram Campaign',
        platforms: ['instagram'],
        totalValue: 100000,
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('contract.created', expect.any(Object));
    });

    it('writes an audit log after successful creation', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });

      await service.create('usr_brand', {
        creatorId: 'cr_1',
        title: 'Instagram Campaign',
        platforms: ['instagram'],
        totalValue: 100000,
      });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONTRACT_CREATED' }),
      );
    });
  });

  describe('findAll', () => {
    it('paginates for BRAND role and enforces max page size', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.contract.findMany.mockResolvedValue([mockCreatedContract]);

      const result = await service.findAll('usr_brand', UserRole.BRAND, 1, 999);

      expect(result).toBeDefined();
    });

    it('returns results for CREATOR role', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.contract.findMany.mockResolvedValue([mockCreatedContract]);

      const result = await service.findAll('usr_creator', UserRole.CREATOR, 1, 25);

      expect(result).toBeDefined();
    });
  });

  describe('sign', () => {
    const mockContractForSign = {
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
      mockPrisma.contract.findUnique.mockResolvedValue(mockContractForSign);
      mockPrisma.brand.findUnique.mockResolvedValue(null); // usr_unrelated has no brand

      await expect(
        service.sign('con_1', 'usr_unrelated', UserRole.BRAND, '1.2.3.4'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows brand to sign and updates brandSignedAt', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContractForSign);
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'br_1' });
      mockPrisma.contract.update.mockResolvedValue({
        ...mockContractForSign,
        brandSignedAt: new Date(),
        status: ContractStatus.PENDING_SIGNATURE,
      });

      await service.sign('con_1', 'usr_brand', UserRole.BRAND, '1.2.3.4');

      expect(mockPrisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ brandSignedAt: expect.any(Date) }),
        }),
      );
    });

    it('activates contract when both parties have signed', async () => {
      const partiallySignedContract = {
        ...mockContractForSign,
        brandSignedAt: new Date(), // brand already signed
      };
      mockPrisma.contract.findUnique.mockResolvedValue(partiallySignedContract);
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
      mockPrisma.contract.update.mockResolvedValue({
        ...partiallySignedContract,
        creatorSignedAt: new Date(),
        status: ContractStatus.ACTIVE,
      });

      await service.sign('con_1', 'usr_creator', UserRole.CREATOR, '1.2.3.5');

      expect(mockPrisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creatorSignedAt: expect.any(Date),
            status: ContractStatus.ACTIVE,
          }),
        }),
      );
    });
  });
});

