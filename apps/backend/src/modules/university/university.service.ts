import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateUniversityDto, CreateCollectiveDto } from './dto/university.dto';

@Injectable()
export class UniversityService {
  private readonly logger = new Logger(UniversityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Universities ────────────────────────────────────────────────────────────

  async create(callerId: string, dto: CreateUniversityDto) {
    if (dto.ncaaSchoolId) {
      const existing = await this.prisma.university.findUnique({
        where: { ncaaSchoolId: dto.ncaaSchoolId },
      });
      if (existing) throw new ConflictException('University with this NCAA school ID already exists');
    }

    const university = await this.prisma.university.create({
      data: {
        name: dto.name,
        shortName: dto.shortName,
        ncaaSchoolId: dto.ncaaSchoolId,
        division: dto.division,
        conference: dto.conference,
        state: dto.state,
        country: dto.country ?? 'US',
        website: dto.website,
        reportingEmail: dto.reportingEmail,
        disclosureRequired: dto.disclosureRequired ?? true,
        disclosureThreshold: dto.disclosureThreshold ?? 0,
        nilPolicy: dto.nilPolicy as never,
      },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'UNIVERSITY_CREATED',
      resource: 'University',
      resourceId: university.id,
      newValue: { name: dto.name, division: dto.division },
    });

    return university;
  }

  async findAll(page = 1, take = 50, state?: string, division?: string) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 200);
    const limit = Math.min(Math.max(1, take), 200);
    const where: Record<string, unknown> = {};
    if (state) where.state = state;
    if (division) where.division = division;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.university.findMany({
        where,
        select: {
          id: true,
          name: true,
          shortName: true,
          division: true,
          conference: true,
          state: true,
          logoUrl: true,
          nilProgramActive: true,
          _count: { select: { athletes: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.university.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const university = await this.prisma.university.findUnique({
      where: { id },
      include: {
        athleticDepartments: true,
        complianceOfficers: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        _count: { select: { athletes: true, complianceReports: true } },
      },
    });
    if (!university) throw new NotFoundException('University not found');
    return university;
  }

  async getAthleteRoster(universityId: string, sport?: string, page = 1, take = 50) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 100);
    const limit = Math.min(Math.max(1, take), 100);
    const where: Record<string, unknown> = { universityId, nilActive: true };
    if (sport) where.sport = sport;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.athlete.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          nilDeals: { where: { status: 'ACTIVE' }, select: { id: true, valueCents: true } },
        },
        orderBy: { performanceScore: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.athlete.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async getDashboardStats(universityId: string) {
    const [
      activeAthletes,
      pendingDisclosures,
      activeDeals,
      totalEarningsResult,
      recentDisclosures,
    ] = await Promise.all([
      this.prisma.athlete.count({ where: { universityId, nilActive: true } }),
      this.prisma.nilDisclosure.count({ where: { universityId, status: 'PENDING_REVIEW' } }),
      this.prisma.nilDeal.count({
        where: { athlete: { universityId }, status: 'ACTIVE' },
      }),
      this.prisma.athlete.aggregate({
        where: { universityId, nilActive: true },
        _sum: { nilEarnedYtdCents: true },
      }),
      this.prisma.nilDisclosure.findMany({
        where: { universityId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          athlete: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
    ]);

    return {
      activeAthletes,
      pendingDisclosures,
      activeDeals,
      totalNilEarningsYtdCents: totalEarningsResult._sum.nilEarnedYtdCents ?? 0,
      recentDisclosures,
    };
  }

  // ─── Collectives ─────────────────────────────────────────────────────────────

  async createCollective(callerId: string, dto: CreateCollectiveDto) {
    const existing = await this.prisma.nilCollective.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Collective with this slug already exists');

    const collective = await this.prisma.nilCollective.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        universityId: dto.universityId,
        sport: dto.sport,
        website: dto.website,
        description: dto.description,
        contactEmail: dto.contactEmail,
        ein: dto.ein,
      },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'COLLECTIVE_CREATED',
      resource: 'NilCollective',
      resourceId: collective.id,
      newValue: { name: dto.name, universityId: dto.universityId },
    });

    return collective;
  }

  async findCollectives(universityId?: string, page = 1, take = 50) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 200);
    const limit = Math.min(Math.max(1, take), 200);
    const where: Record<string, unknown> = {};
    if (universityId) where.universityId = universityId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.nilCollective.findMany({
        where,
        include: {
          university: { select: { name: true, shortName: true } },
          _count: { select: { nilDeals: true } },
        },
        orderBy: { totalFundsRaisedCents: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.nilCollective.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }
}
