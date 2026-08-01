import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaxDocumentStatus } from '@prisma/client';
import { TaxDocumentsService } from './tax-documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { RequestTaxDocumentDto, SubmitTaxDocumentDto } from './dto/tax-documents.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  taxDocument: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  athlete: { findFirst: jest.fn() },
  creator: { findFirst: jest.fn() },
};
const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockEventBus = { emit: jest.fn().mockResolvedValue(undefined) };

const USER = 'user_1';

describe('TaxDocumentsService', () => {
  let service: TaxDocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxDocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<TaxDocumentsService>(TaxDocumentsService);
    jest.clearAllMocks();
  });

  describe('requestDocument', () => {
    it('requires an athleteId or creatorId', async () => {
      await expect(
        service.requestDocument({ type: 'W9', taxYear: 2025 } as RequestTaxDocumentDto, USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a REQUESTED document and emits the request event', async () => {
      mockPrisma.taxDocument.create.mockResolvedValue({ id: 'tax_1' });
      const dto = { type: 'W9', taxYear: 2025, creatorId: 'cr_1' } as RequestTaxDocumentDto;

      const result = await service.requestDocument(dto, USER);

      expect(mockPrisma.taxDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TaxDocumentStatus.REQUESTED }) }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('tax.document.requested', expect.objectContaining({ docId: 'tax_1' }));
      expect(result).toEqual({ id: 'tax_1' });
    });
  });

  describe('submitDocument', () => {
    it('forbids a user who does not own the linked creator profile', async () => {
      mockPrisma.taxDocument.findUnique.mockResolvedValue({ id: 'tax_1', status: TaxDocumentStatus.REQUESTED, athleteId: null, creatorId: 'cr_1' });
      mockPrisma.creator.findFirst.mockResolvedValue(null); // not owned by this user

      await expect(
        service.submitDocument('tax_1', {} as SubmitTaxDocumentDto, USER),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.taxDocument.update).not.toHaveBeenCalled();
    });

    it('rejects submitting a document that is not in REQUESTED status', async () => {
      mockPrisma.taxDocument.findUnique.mockResolvedValue({ id: 'tax_1', status: TaxDocumentStatus.SUBMITTED, athleteId: null, creatorId: 'cr_1' });
      await expect(
        service.submitDocument('tax_1', {} as SubmitTaxDocumentDto, USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks SUBMITTED and emits the submit event when the owner submits', async () => {
      mockPrisma.taxDocument.findUnique.mockResolvedValue({ id: 'tax_1', status: TaxDocumentStatus.REQUESTED, athleteId: null, creatorId: 'cr_1', type: 'W9', taxYear: 2025 });
      mockPrisma.creator.findFirst.mockResolvedValue({ id: 'cr_1', userId: USER });
      mockPrisma.taxDocument.update.mockResolvedValue({ id: 'tax_1', status: TaxDocumentStatus.SUBMITTED });

      await service.submitDocument('tax_1', {} as SubmitTaxDocumentDto, USER);

      expect(mockPrisma.taxDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TaxDocumentStatus.SUBMITTED }) }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('tax.document.submitted', expect.objectContaining({ docId: 'tax_1' }));
    });
  });

  describe('verifyDocument', () => {
    it('rejects verifying a document that is not SUBMITTED', async () => {
      mockPrisma.taxDocument.findUnique.mockResolvedValue({ id: 'tax_1', status: TaxDocumentStatus.REQUESTED });
      await expect(service.verifyDocument('tax_1', 'admin')).rejects.toThrow(BadRequestException);
    });

    it('marks the document VERIFIED', async () => {
      mockPrisma.taxDocument.findUnique.mockResolvedValue({ id: 'tax_1', status: TaxDocumentStatus.SUBMITTED });
      mockPrisma.taxDocument.update.mockResolvedValue({ id: 'tax_1', status: TaxDocumentStatus.VERIFIED });
      await service.verifyDocument('tax_1', 'admin');
      expect(mockPrisma.taxDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TaxDocumentStatus.VERIFIED }) }),
      );
    });
  });

  describe('getSummaryByYear', () => {
    it('counts by status and sums total paid cents', async () => {
      mockPrisma.taxDocument.findMany.mockResolvedValue([
        { status: TaxDocumentStatus.VERIFIED, totalAmountCents: 100_000 },
        { status: TaxDocumentStatus.VERIFIED, totalAmountCents: 50_000 },
        { status: TaxDocumentStatus.REQUESTED, totalAmountCents: null },
      ]);

      const summary = await service.getSummaryByYear(2025);

      expect(summary.count).toBe(3);
      expect(summary.byStatus[TaxDocumentStatus.VERIFIED]).toBe(2);
      expect(summary.byStatus[TaxDocumentStatus.REQUESTED]).toBe(1);
      expect(summary.totalPaidCents).toBe(150_000);
    });
  });
});
