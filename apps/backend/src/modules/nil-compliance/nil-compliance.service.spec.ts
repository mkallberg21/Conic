import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { NilDisclosureStatus } from '@prisma/client';
import { NilComplianceService } from './nil-compliance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateNilDealDto, ReviewDisclosureDto } from './dto/nil-deal.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  athlete: { findUnique: jest.fn() },
  nilDeal: { create: jest.fn() },
  nilDisclosure: { findUnique: jest.fn(), update: jest.fn() },
};
const mockEventBus = { emit: jest.fn() };
const mockAudit = { log: jest.fn() };
const mockHttp = { post: jest.fn() };
const mockConfig = { get: jest.fn((_k: string, def?: unknown) => def) };

const CALLER = 'user_officer';

describe('NilComplianceService', () => {
  let service: NilComplianceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NilComplianceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: AuditService, useValue: mockAudit },
        { provide: HttpService, useValue: mockHttp },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<NilComplianceService>(NilComplianceService);
    jest.clearAllMocks();
  });

  describe('createNilDeal', () => {
    const dto = { athleteId: 'ath_1', valueCents: 20_000, dealType: 'sponsorship', title: 'Deal' } as unknown as CreateNilDealDto;

    it('throws NotFoundException when the athlete does not exist', async () => {
      mockPrisma.athlete.findUnique.mockResolvedValue(null);
      await expect(service.createNilDeal(CALLER, dto)).rejects.toThrow(NotFoundException);
    });

    it('forbids a deal for an athlete not enrolled in the NIL program', async () => {
      mockPrisma.athlete.findUnique.mockResolvedValue({ id: 'ath_1', nilActive: false });
      await expect(service.createNilDeal(CALLER, dto)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a deal that exceeds the athlete’s remaining annual NIL cap', async () => {
      // cap 100_000, already earned 90_000 → remaining 10_000; deal asks 20_000
      mockPrisma.athlete.findUnique.mockResolvedValue({
        id: 'ath_1', nilActive: true, nilCapCents: 100_000, nilEarnedYtdCents: 90_000,
      });
      await expect(service.createNilDeal(CALLER, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.nilDeal.create).not.toHaveBeenCalled();
    });

    it('creates a PENDING deal and emits NIL_DEAL_CREATED (AI failure is tolerated)', async () => {
      mockPrisma.athlete.findUnique.mockResolvedValue({
        id: 'ath_1', nilActive: true, nilCapCents: null, nilEarnedYtdCents: 0,
      });
      // AI risk service unreachable → caught, risk defaults to 0, deal still created
      mockHttp.post.mockReturnValue(throwError(() => new Error('AI down')));
      mockPrisma.nilDeal.create.mockResolvedValue({ id: 'deal_1' });

      const result = await service.createNilDeal(CALLER, dto);

      expect(mockPrisma.nilDeal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', aiRiskScore: 0 }) }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('nil.deal.created', expect.objectContaining({ dealId: 'deal_1' }));
      expect(result).toEqual({ id: 'deal_1' });
    });

    it('records the AI risk score when the assessment service responds', async () => {
      mockPrisma.athlete.findUnique.mockResolvedValue({
        id: 'ath_1', nilActive: true, nilCapCents: null, nilEarnedYtdCents: 0,
      });
      mockHttp.post.mockReturnValue(of({ data: { riskScore: 42, flags: ['high-value'] } }));
      mockPrisma.nilDeal.create.mockResolvedValue({ id: 'deal_2' });

      await service.createNilDeal(CALLER, dto);

      expect(mockPrisma.nilDeal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ aiRiskScore: 42 }) }),
      );
    });
  });

  describe('reviewDisclosure', () => {
    it('rejects reviewing a disclosure that is not pending review', async () => {
      mockPrisma.nilDisclosure.findUnique.mockResolvedValue({ id: 'disc_1', status: NilDisclosureStatus.APPROVED });
      await expect(
        service.reviewDisclosure(CALLER, { disclosureId: 'disc_1', decision: 'APPROVED' } as ReviewDisclosureDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('APPROVED transitions the disclosure to APPROVED and emits the event', async () => {
      mockPrisma.nilDisclosure.findUnique.mockResolvedValue({
        id: 'disc_1', status: NilDisclosureStatus.PENDING_REVIEW, athleteId: 'ath_1',
      });
      mockPrisma.nilDisclosure.update.mockResolvedValue({ id: 'disc_1', status: NilDisclosureStatus.APPROVED });

      await service.reviewDisclosure(CALLER, { disclosureId: 'disc_1', decision: 'APPROVED' } as ReviewDisclosureDto);

      expect(mockPrisma.nilDisclosure.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: NilDisclosureStatus.APPROVED }) }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('nil.disclosure.approved', expect.objectContaining({ disclosureId: 'disc_1' }));
    });
  });
});
