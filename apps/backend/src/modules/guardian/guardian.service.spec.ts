import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { GuardianService } from './guardian.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AuditService } from '../../common/audit/audit.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  guardian: { findUnique: jest.fn() },
  guardianApproval: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  guardianRelationship: { findMany: jest.fn() },
  nilDeal: { update: jest.fn() },
  contractNilExtension: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventBus = { emit: jest.fn() };
const mockAudit = { log: jest.fn() };

const GUARDIAN_USER = 'user_guardian';
const GUARDIAN_ID = 'guardian_1';
const future = () => new Date(Date.now() + 60 * 60 * 1000);
const past = () => new Date(Date.now() - 60 * 60 * 1000);

describe('GuardianService', () => {
  let service: GuardianService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuardianService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<GuardianService>(GuardianService);
    jest.clearAllMocks();
  });

  describe('respond', () => {
    const pendingApproval = {
      id: 'appr_1',
      guardianId: GUARDIAN_ID,
      status: ApprovalStatus.PENDING,
      resourceType: 'nil_deal',
      resourceId: 'deal_1',
      expiresAt: future(),
    };

    it('throws NotFoundException when the guardian profile is missing', async () => {
      mockPrisma.guardian.findUnique.mockResolvedValue(null);
      await expect(
        service.respond(GUARDIAN_USER, 'appr_1', 'APPROVED'),
      ).rejects.toThrow(NotFoundException);
    });

    it('forbids responding to another guardian’s approval request (IDOR)', async () => {
      mockPrisma.guardian.findUnique.mockResolvedValue({ id: GUARDIAN_ID });
      mockPrisma.guardianApproval.findUnique.mockResolvedValue({
        ...pendingApproval,
        guardianId: 'someone_else',
      });

      await expect(
        service.respond(GUARDIAN_USER, 'appr_1', 'APPROVED'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.guardianApproval.update).not.toHaveBeenCalled();
    });

    it('rejects a request that was already responded to', async () => {
      mockPrisma.guardian.findUnique.mockResolvedValue({ id: GUARDIAN_ID });
      mockPrisma.guardianApproval.findUnique.mockResolvedValue({
        ...pendingApproval,
        status: ApprovalStatus.APPROVED,
      });

      await expect(
        service.respond(GUARDIAN_USER, 'appr_1', 'APPROVED'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('marks an expired request EXPIRED and refuses it', async () => {
      mockPrisma.guardian.findUnique.mockResolvedValue({ id: GUARDIAN_ID });
      mockPrisma.guardianApproval.findUnique.mockResolvedValue({
        ...pendingApproval,
        expiresAt: past(),
      });
      mockPrisma.guardianApproval.update.mockResolvedValue({});

      await expect(
        service.respond(GUARDIAN_USER, 'appr_1', 'APPROVED'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.guardianApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApprovalStatus.EXPIRED } }),
      );
    });

    it('APPROVED: updates status, applies the approval to the nil_deal, and emits GUARDIAN_APPROVED', async () => {
      mockPrisma.guardian.findUnique.mockResolvedValue({ id: GUARDIAN_ID });
      mockPrisma.guardianApproval.findUnique.mockResolvedValue(pendingApproval);
      mockPrisma.guardianApproval.update.mockResolvedValue({ id: 'appr_1', status: ApprovalStatus.APPROVED });
      mockPrisma.nilDeal.update.mockResolvedValue({});

      await service.respond(GUARDIAN_USER, 'appr_1', 'APPROVED', 'looks good', '1.2.3.4');

      expect(mockPrisma.guardianApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ApprovalStatus.APPROVED }) }),
      );
      // applyApproval → nil_deal gets guardianApproved = true
      expect(mockPrisma.nilDeal.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'deal_1' }, data: { guardianApproved: true } }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'guardian.approved',
        expect.objectContaining({ approvalId: 'appr_1', decision: 'APPROVED' }),
      );
    });

    it('REJECTED: does NOT apply the approval and emits GUARDIAN_REJECTED', async () => {
      mockPrisma.guardian.findUnique.mockResolvedValue({ id: GUARDIAN_ID });
      mockPrisma.guardianApproval.findUnique.mockResolvedValue(pendingApproval);
      mockPrisma.guardianApproval.update.mockResolvedValue({ id: 'appr_1', status: ApprovalStatus.REJECTED });

      await service.respond(GUARDIAN_USER, 'appr_1', 'REJECTED');

      expect(mockPrisma.nilDeal.update).not.toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'guardian.rejected',
        expect.objectContaining({ decision: 'REJECTED' }),
      );
    });
  });

  describe('requestApproval', () => {
    it('creates a pending approval for every guardian who can approve', async () => {
      mockPrisma.guardianRelationship.findMany.mockResolvedValue([
        { guardianId: 'g1', guardian: {} },
        { guardianId: 'g2', guardian: {} },
      ]);
      mockPrisma.guardianApproval.create.mockImplementation((args: unknown) => args);
      mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);

      const result = await service.requestApproval('nil_deal', 'deal_9', 'athlete_1', 48);

      expect(mockPrisma.guardianApproval.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      // both created as PENDING with an expiry in the future
      expect(mockPrisma.guardianApproval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ApprovalStatus.PENDING, resourceId: 'deal_9' }),
        }),
      );
    });
  });
});
