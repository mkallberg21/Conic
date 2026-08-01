import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DealRoomStatus, ProposalStatus, UserRole } from '@prisma/client';
import { DealRoomService } from './deal-room.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AiService } from '../ai/ai.service';
import { CreateProposalDto } from './dto/deal-room.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  contract: { findUnique: jest.fn() },
  dealRoom: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  dealRoomMessage: { create: jest.fn() },
  dealRoomProposal: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const mockAudit = { log: jest.fn() };
const mockAi = { scoreContractRisk: jest.fn() };

const BRAND_USER = 'user_brand';
const CREATOR_USER = 'user_creator';
const OUTSIDER = 'user_outsider';

// A contract whose parties are the brand and creator users above
const contractWithRoom = {
  id: 'contract_1',
  title: 'Q1 Campaign',
  brand: { userId: BRAND_USER },
  creator: { userId: CREATOR_USER },
  dealRoom: { id: 'room_1', status: DealRoomStatus.OPEN },
};

describe('DealRoomService', () => {
  let service: DealRoomService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealRoomService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: AiService, useValue: mockAi },
      ],
    }).compile();

    service = module.get<DealRoomService>(DealRoomService);
    jest.clearAllMocks();
  });

  describe('access control', () => {
    it('rejects a caller who is not a party to the contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contractWithRoom);

      await expect(
        service.getRoom('contract_1', OUTSIDER, UserRole.CREATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an ADMIN who is not a party', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contractWithRoom);
      mockPrisma.dealRoom.findUnique.mockResolvedValue({ id: 'room_1', messages: [], proposals: [] });

      await expect(
        service.getRoom('contract_1', 'user_admin', UserRole.ADMIN),
      ).resolves.toBeDefined();
    });

    it('throws NotFoundException when the contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.getRoom('missing', BRAND_USER, UserRole.BRAND),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createProposal', () => {
    const dto: CreateProposalDto = {
      title: 'Lower the exclusivity window',
      changes: [{ clauseType: 'exclusivity', original: '12mo', proposed: '3mo' }],
    };

    it('still creates the proposal when AI risk scoring fails (failure is swallowed)', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contractWithRoom);
      mockAi.scoreContractRisk.mockRejectedValue(new Error('AI service down'));
      mockPrisma.dealRoomProposal.create.mockResolvedValue({ id: 'prop_1' });
      mockPrisma.dealRoomMessage.create.mockResolvedValue({});

      const result = await service.createProposal('contract_1', BRAND_USER, UserRole.BRAND, dto);

      expect(result).toEqual({ id: 'prop_1' });
      // aiRiskDelta / aiSummary must be undefined when scoring failed
      expect(mockPrisma.dealRoomProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ aiRiskDelta: undefined, aiSummary: undefined }),
        }),
      );
    });

    it('rejects proposals when the room is not OPEN', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...contractWithRoom,
        dealRoom: { id: 'room_1', status: DealRoomStatus.CLOSED },
      });

      await expect(
        service.createProposal('contract_1', BRAND_USER, UserRole.BRAND, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveProposal', () => {
    const pendingProposal = {
      id: 'prop_1',
      dealRoomId: 'room_1',
      status: ProposalStatus.PENDING,
      proposedById: BRAND_USER,
      title: 'Lower fee',
    };

    beforeEach(() => {
      mockPrisma.contract.findUnique.mockResolvedValue(contractWithRoom);
    });

    it('forbids the proposer from accepting their own proposal', async () => {
      mockPrisma.dealRoomProposal.findUnique.mockResolvedValue(pendingProposal);

      await expect(
        service.resolveProposal('contract_1', 'prop_1', BRAND_USER, UserRole.BRAND, 'accept'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.dealRoomProposal.update).not.toHaveBeenCalled();
    });

    it('rejects a proposal that has already been resolved', async () => {
      mockPrisma.dealRoomProposal.findUnique.mockResolvedValue({
        ...pendingProposal,
        status: ProposalStatus.ACCEPTED,
      });

      await expect(
        service.resolveProposal('contract_1', 'prop_1', CREATOR_USER, UserRole.CREATOR, 'accept'),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps accept → ACCEPTED and records the resolver + an acceptance message', async () => {
      mockPrisma.dealRoomProposal.findUnique.mockResolvedValue(pendingProposal);
      mockPrisma.dealRoomProposal.update.mockResolvedValue({ id: 'prop_1' });
      mockPrisma.dealRoomMessage.create.mockResolvedValue({});

      // Counterparty (creator) accepts the brand's proposal
      await service.resolveProposal('contract_1', 'prop_1', CREATOR_USER, UserRole.CREATOR, 'accept');

      expect(mockPrisma.dealRoomProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ProposalStatus.ACCEPTED,
            resolvedById: CREATOR_USER,
          }),
        }),
      );
      expect(mockPrisma.dealRoomMessage.create).toHaveBeenCalled();
    });

    it('maps reject → REJECTED without posting an acceptance message', async () => {
      mockPrisma.dealRoomProposal.findUnique.mockResolvedValue(pendingProposal);
      mockPrisma.dealRoomProposal.update.mockResolvedValue({ id: 'prop_1' });

      await service.resolveProposal('contract_1', 'prop_1', CREATOR_USER, UserRole.CREATOR, 'reject');

      expect(mockPrisma.dealRoomProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ProposalStatus.REJECTED }) }),
      );
      expect(mockPrisma.dealRoomMessage.create).not.toHaveBeenCalled();
    });
  });

  describe('closeRoom', () => {
    beforeEach(() => {
      mockPrisma.contract.findUnique.mockResolvedValue(contractWithRoom);
    });

    it('marks the room AGREED with an agreedAt timestamp when agreed=true', async () => {
      mockPrisma.dealRoom.update.mockResolvedValue({ id: 'room_1', status: DealRoomStatus.AGREED });

      await service.closeRoom('contract_1', BRAND_USER, UserRole.BRAND, true);

      expect(mockPrisma.dealRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DealRoomStatus.AGREED, agreedAt: expect.any(Date) }),
        }),
      );
    });

    it('marks the room CLOSED with a closedAt timestamp when agreed=false', async () => {
      mockPrisma.dealRoom.update.mockResolvedValue({ id: 'room_1', status: DealRoomStatus.CLOSED });

      await service.closeRoom('contract_1', BRAND_USER, UserRole.BRAND, false);

      expect(mockPrisma.dealRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DealRoomStatus.CLOSED, closedAt: expect.any(Date) }),
        }),
      );
    });

    it('rejects closing a room that is not OPEN', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...contractWithRoom,
        dealRoom: { id: 'room_1', status: DealRoomStatus.AGREED },
      });

      await expect(
        service.closeRoom('contract_1', BRAND_USER, UserRole.BRAND, false),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
