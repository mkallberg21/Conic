import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ImportJobStatus, ImportType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateImportJobDto } from './dto/importers.dto';

interface ParsedRow {
  email?: string;
  firstName?: string;
  lastName?: string;
  sport?: string;
  platform?: string;
  followersCount?: string;
  engagementRate?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class ImportersService {
  private readonly logger = new Logger(ImportersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createJob(dto: CreateImportJobDto, userId: string) {
    const job = await this.prisma.importJob.create({
      data: {
        userId,
        type: dto.type,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl ?? null,
        status: ImportJobStatus.PENDING,
      },
    });
    await this.auditService.log({
      userId,
      action: 'import_job.created',
      resource: 'ImportJob',
      resourceId: job.id,
      metadata: { type: dto.type, fileName: dto.fileName },
    });
    return job;
  }

  async processJob(jobId: string, csvContent: string, userId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Import job not found');
    if (job.userId !== userId) throw new ForbiddenException('Not your import job');
    if (job.status !== ImportJobStatus.PENDING) {
      throw new BadRequestException('Job is not in PENDING status');
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.PROCESSING },
    });

    try {
      const rows = this.parseCsv(csvContent);
      const result = await this.processRows(rows, job.type, userId);

      const finalStatus =
        result.errorRows > 0 && result.processedRows === 0
          ? ImportJobStatus.FAILED
          : result.errorRows > 0
          ? ImportJobStatus.PARTIAL
          : ImportJobStatus.COMPLETED;

      const updated = await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: finalStatus,
          totalRows: result.totalRows,
          processedRows: result.processedRows,
          errorRows: result.errorRows,
          errors: result.errors,
          completedAt: new Date(),
        },
      });

      await this.auditService.log({
        userId,
        action: 'import_job.completed',
        resource: 'ImportJob',
        resourceId: jobId,
        metadata: { status: finalStatus, processedRows: result.processedRows },
      });

      return updated;
    } catch (err) {
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { status: ImportJobStatus.FAILED, errors: [{ message: String(err) }] },
      });
      throw err;
    }
  }

  async findAllForUser(userId: string) {
    return this.prisma.importJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(jobId: string, userId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Import job not found');
    if (job.userId !== userId) throw new ForbiddenException('Not your import job');
    return job;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private parseCsv(content: string): ParsedRow[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce<ParsedRow>((row, h, i) => {
        row[h] = values[i]?.trim() ?? '';
        return row;
      }, {});
    });
  }

  private async processRows(
    rows: ParsedRow[],
    type: ImportType,
    userId: string,
  ): Promise<{ totalRows: number; processedRows: number; errorRows: number; errors: object[] }> {
    const errors: { row: number; message: string }[] = [];
    let processedRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (type === ImportType.CREATOR_CSV || type === ImportType.GENERIC_CSV) {
          await this.importCreatorRow(row, userId);
        } else if (type === ImportType.ATHLETE_CSV) {
          await this.importAthleteRow(row, userId);
        } else if (
          type === ImportType.OPENDORSE_EXPORT ||
          type === ImportType.TEAMWORKS_EXPORT
        ) {
          await this.importAthleteRow(row, userId);
        }
        processedRows++;
      } catch (err) {
        errors.push({ row: i + 2, message: String(err) });
      }
    }

    return { totalRows: rows.length, processedRows, errorRows: errors.length, errors };
  }

  private async importCreatorRow(row: ParsedRow, _userId: string): Promise<void> {
    if (!row.email) throw new Error('email is required');
    // Upsert user + creator profile from CSV row
    await this.prisma.user.upsert({
      where: { email: row.email },
      create: {
        email: row.email,
        passwordHash: '',
        role: 'CREATOR',
        firstName: row.first_name ?? row.firstname ?? '',
        lastName: row.last_name ?? row.lastname ?? '',
        creator: {
          create: {
            handle: row.handle ?? row.email?.split('@')[0] ?? 'imported',
            followersCount: parseInt(row.followers_count ?? '0', 10),
            engagementRate: parseFloat(row.engagement_rate ?? '0'),
            niche: row.niche ? [row.niche] : [],
            platforms: {},
          },
        },
      },
      update: {},
    });
  }

  private async importAthleteRow(row: ParsedRow, _userId: string): Promise<void> {
    if (!row.email) throw new Error('email is required');
    if (!row.sport) throw new Error('sport is required');
    await this.prisma.user.upsert({
      where: { email: row.email },
      create: {
        email: row.email,
        passwordHash: '',
        role: 'ATHLETE',
        firstName: row.first_name ?? row.firstname ?? '',
        lastName: row.last_name ?? row.lastname ?? '',
        athlete: {
          create: {
            sport: row.sport,
            position: row.position ?? null,
            followersCount: parseInt(row.followers_count ?? '0', 10),
            engagementRate: parseFloat(row.engagement_rate ?? '0'),
          },
        },
      },
      update: {},
    });
  }
}
