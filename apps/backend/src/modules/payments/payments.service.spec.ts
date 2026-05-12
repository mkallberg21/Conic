import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AuditService } from '../../common/audit/audit.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

const BRAND_USER_ID = 'usr_brand_1';
const CREATOR_USER_ID = 'usr_creator_1';

const mockBrand = { id: 'brand_1', userId: BRAND_USER_ID };
const mockCreator = { id: 'creator_1', userId: CREATOR_USER_ID, dwollaCustomerId: null };

const mockPendingPayment = {
  id: 'pay_1',
  contractId: 'contract_1',
  deliverableId: 'del_1',
  amount: 10000,
  netAmount: 9500,
  currency: 'USD',
  platformFee: 500,
  status: PaymentStatus.PENDING,
  contract: {
    brandId: 'brand_1',
    creatorId: 'creator_1',
    creator: { ...mockCreator, user: { firstName: 'Test', lastName: 'Creator', email: 'c@t.com' } },
  },
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  creator: { findUnique: jest.fn() },
  brand: { findUnique: jest.fn() },
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation(async (fns) => Promise.all(fns)),
};

const mockEventBus = { emit: jest.fn() };
const mockAuditService = { log: jest.fn().mockResolvedValue(undefined) };

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      'dwolla.key': 'mock-key',
      'dwolla.secret': 'mock-secret',
      'dwolla.environment': 'sandbox',
      'dwolla.masterFundingSourceUrl': '',
      'dwolla.platformFeeRate': 0.05,
    };
    return config[key] ?? defaultValue;
  }),
};

// Mock Dwolla Client constructor
jest.mock('dwolla-v2', () => ({
  Client: jest.fn().mockImplementation(() => ({
    auth: {
      client: jest.fn().mockResolvedValue({
        get: jest.fn(),
        post: jest.fn(),
      }),
    },
  })),
}));

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();

    // Reset defaults
    mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
    mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);
    mockPrisma.payment.findUnique.mockResolvedValue(mockPendingPayment);
    mockPrisma.$transaction.mockImplementation(async (fns) => Promise.all(fns));
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated list for BRAND', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[mockPendingPayment], 1]);

      const result = await service.findAll(BRAND_USER_ID, UserRole.BRAND, 1, 25);

      expect(result).toEqual(
        expect.objectContaining({
          items: expect.arrayContaining([expect.objectContaining({ id: 'pay_1' })]),
          total: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        }),
      );
    });

    it('caps page size at 100', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      const result = await service.findAll(BRAND_USER_ID, UserRole.BRAND, 1, 9999);

      expect(result.pageSize).toBe(100);
    });

    it('normalises page to 1 when 0 passed', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      const result = await service.findAll(BRAND_USER_ID, UserRole.BRAND, 0, 25);

      expect(result.page).toBe(1);
    });
  });

  // ── release ────────────────────────────────────────────────────────────────

  describe('release', () => {
    it('throws NotFoundException when payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.release('pay_missing', BRAND_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when brand does not own the contract', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_other' });
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPendingPayment,
        contract: { ...mockPendingPayment.contract, brandId: 'brand_1' },
      });

      await expect(service.release('pay_1', BRAND_USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when payment is not PENDING', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPendingPayment,
        status: PaymentStatus.COMPLETED,
      });

      await expect(service.release('pay_1', BRAND_USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('marks payment COMPLETED when no Dwolla account configured', async () => {
      // No masterFundingSourceUrl means test/manual flow
      mockConfigService.get.mockImplementation((key: string, d?: unknown) => {
        if (key === 'dwolla.masterFundingSourceUrl') return '';
        return d;
      });
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPendingPayment,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });

      const result = await service.release('pay_1', BRAND_USER_ID);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.COMPLETED }),
        }),
      );
      expect(result.paymentId).toBe('pay_1');
    });

    it('marks payment FAILED and emits PAYMENT_FAILED event on Dwolla error', async () => {
      const err = new Error('Dwolla auth failure');

      mockPrisma.brand.findUnique.mockResolvedValue(mockBrand);
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPendingPayment,
        contract: {
          ...mockPendingPayment.contract,
          creator: { ...mockCreator, dwollaCustomerId: 'https://api-sandbox.dwolla.com/customers/123' },
        },
      });
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPendingPayment,
        status: PaymentStatus.FAILED,
      });

      // Config with a real platform funding source so the Dwolla code path runs
      const failConfig = {
        get: jest.fn((key: string) => {
          const cfg: Record<string, unknown> = {
            'dwolla.key': 'mock-key',
            'dwolla.secret': 'mock-secret',
            'dwolla.environment': 'sandbox',
            'dwolla.masterFundingSourceUrl': 'https://api-sandbox.dwolla.com/funding-sources/platform-source',
            'dwolla.platformFeeRate': 0.05,
          };
          return cfg[key] ?? undefined;
        }),
      };

      // Simulate appToken throwing for this service instance
      const { Client } = jest.requireMock('dwolla-v2') as { Client: jest.Mock };
      Client.mockImplementationOnce(() => ({
        auth: { client: jest.fn().mockRejectedValue(err) },
      }));

      // Re-create the service so it picks up the new Dwolla mock and config
      const failModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventBusService, useValue: mockEventBus },
          { provide: AuditService, useValue: mockAuditService },
          { provide: ConfigService, useValue: failConfig },
        ],
      }).compile();
      const svc = failModule.get<PaymentsService>(PaymentsService);

      await expect(svc.release('pay_1', BRAND_USER_ID)).rejects.toThrow();

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PaymentStatus.FAILED },
        }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'payment.failed',
        expect.objectContaining({ paymentId: 'pay_1' }),
      );
    });

    it('emits PAYMENT_RELEASED and logs audit on success', async () => {
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPendingPayment,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });

      await service.release('pay_1', BRAND_USER_ID);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({ paymentId: 'pay_1' }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_RELEASED' }),
      );
    });
  });

  // ── handleDeliverableApproved ──────────────────────────────────────────────

  describe('handleDeliverableApproved', () => {
    it('skips creation when payment already exists for deliverable', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({ id: 'pay_existing' });

      await service.handleDeliverableApproved({
        deliverableId: 'del_1',
        contractId: 'con_1',
        paymentAmount: 10000,
      });

      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('creates payment with platform fee on first invocation', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay_new' });
      mockConfigService.get.mockImplementation((key: string, d?: unknown) => {
        if (key === 'dwolla.platformFeeRate') return 0.05;
        return d;
      });

      await service.handleDeliverableApproved({
        deliverableId: 'del_1',
        contractId: 'con_1',
        paymentAmount: 10000,
      });

      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 10000,
            platformFee: 500,
            netAmount: 9500,
          }),
        }),
      );
    });
  });
});
