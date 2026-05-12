import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { TaxDocumentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { RequestTaxDocumentDto, SubmitTaxDocumentDto } from './dto/tax-documents.dto';

@Injectable()
export class TaxDocumentsService {
  private readonly logger = new Logger(TaxDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  // ─── Admin / Platform Requests ────────────────────────────────────────────

  async requestDocument(dto: RequestTaxDocumentDto, requestedByUserId: string) {
    if (!dto.athleteId && !dto.creatorId) {
      throw new BadRequestException('athleteId or creatorId is required');
    }
    const doc = await this.prisma.taxDocument.create({
      data: {
        type: dto.type,
        taxYear: dto.taxYear,
        athleteId: dto.athleteId ?? null,
        creatorId: dto.creatorId ?? null,
        status: TaxDocumentStatus.REQUESTED,
      },
    });
    await this.auditService.log({
      userId: requestedByUserId,
      action: 'tax_document.requested',
      resource: 'TaxDocument',
      resourceId: doc.id,
      metadata: { type: dto.type, taxYear: dto.taxYear },
    });
    await this.eventBus.emit(EVENTS.TAX_DOCUMENT_REQUESTED, { docId: doc.id, ...dto });
    return doc;
  }

  // ─── Athlete / Creator Submission ─────────────────────────────────────────

  async submitDocument(docId: string, dto: SubmitTaxDocumentDto, userId: string) {
    const doc = await this.prisma.taxDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Tax document not found');
    if (doc.status !== TaxDocumentStatus.REQUESTED) {
      throw new BadRequestException('Document is not in REQUESTED status');
    }
    // Verify ownership: athlete or creator linked to the requesting user
    await this.assertOwnership(doc, userId);

    const updated = await this.prisma.taxDocument.update({
      where: { id: docId },
      data: {
        ...dto,
        status: TaxDocumentStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });
    await this.auditService.log({
      userId,
      action: 'tax_document.submitted',
      resource: 'TaxDocument',
      resourceId: docId,
      metadata: { type: doc.type, taxYear: doc.taxYear },
    });
    await this.eventBus.emit(EVENTS.TAX_DOCUMENT_SUBMITTED, { docId, userId });
    return updated;
  }

  // ─── Admin Verification ───────────────────────────────────────────────────

  async verifyDocument(docId: string, adminUserId: string) {
    const doc = await this.prisma.taxDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Tax document not found');
    if (doc.status !== TaxDocumentStatus.SUBMITTED) {
      throw new BadRequestException('Document must be in SUBMITTED status to verify');
    }
    const updated = await this.prisma.taxDocument.update({
      where: { id: docId },
      data: { status: TaxDocumentStatus.VERIFIED, verifiedAt: new Date() },
    });
    await this.auditService.log({
      userId: adminUserId,
      action: 'tax_document.verified',
      resource: 'TaxDocument',
      resourceId: docId,
    });
    return updated;
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAllForAthlete(athleteId: string) {
    return this.prisma.taxDocument.findMany({
      where: { athleteId },
      orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findAllForCreator(creatorId: string) {
    return this.prisma.taxDocument.findMany({
      where: { creatorId },
      orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findPendingAdmin() {
    return this.prisma.taxDocument.findMany({
      where: { status: { in: [TaxDocumentStatus.REQUESTED, TaxDocumentStatus.SUBMITTED] } },
      orderBy: { createdAt: 'asc' },
      include: {
        athlete: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        creator: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      },
    });
  }

  async getSummaryByYear(taxYear: number) {
    const docs = await this.prisma.taxDocument.findMany({
      where: { taxYear },
      select: {
        type: true,
        status: true,
        totalAmountCents: true,
        athleteId: true,
        creatorId: true,
      },
    });
    const byStatus = docs.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    }, {});
    const totalPaidCents = docs.reduce((sum, d) => sum + (d.totalAmountCents ?? 0), 0);
    return { taxYear, count: docs.length, byStatus, totalPaidCents };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async assertOwnership(doc: { athleteId: string | null; creatorId: string | null }, userId: string) {
    if (doc.athleteId) {
      const athlete = await this.prisma.athlete.findFirst({ where: { id: doc.athleteId, userId } });
      if (!athlete) throw new ForbiddenException('Not authorized for this document');
    } else if (doc.creatorId) {
      const creator = await this.prisma.creator.findFirst({ where: { id: doc.creatorId, userId } });
      if (!creator) throw new ForbiddenException('Not authorized for this document');
    }
  }
}
