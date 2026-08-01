import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { UpsertListingDto, SearchListingsDto } from './dto/nil-marketplace.dto';

@Injectable()
export class NilMarketplaceService {
  private readonly logger = new Logger(NilMarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Athlete Self-Management ──────────────────────────────────────────────

  async upsertListing(dto: UpsertListingDto, userId: string) {
    const athlete = await this.prisma.athlete.findUnique({ where: { userId } });
    if (!athlete) throw new NotFoundException('Athlete profile not found');

    const listing = await this.prisma.nilMarketplaceListing.upsert({
      where: { athleteId: athlete.id },
      create: {
        athleteId: athlete.id,
        ...dto,
      },
      update: dto,
    });

    await this.auditService.log({
      userId,
      action: 'nil_marketplace.listing_upserted',
      resource: 'NilMarketplaceListing',
      resourceId: listing.id,
    });
    return listing;
  }

  async toggleVisibility(userId: string, isVisible: boolean) {
    const athlete = await this.prisma.athlete.findUnique({ where: { userId } });
    if (!athlete) throw new NotFoundException('Athlete profile not found');
    const listing = await this.prisma.nilMarketplaceListing.findUnique({
      where: { athleteId: athlete.id },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return this.prisma.nilMarketplaceListing.update({
      where: { id: listing.id },
      data: { isVisible },
    });
  }

  // ─── Discovery (Brands / Agencies) ───────────────────────────────────────

  async search(dto: SearchListingsDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isVisible: true };

    if (dto.sport) {
      where['sport'] = { contains: dto.sport, mode: 'insensitive' };
    }
    if (dto.minFollowers) {
      where['socialFollowersTotal'] = { gte: dto.minFollowers };
    }
    if (dto.maxDealValueCents) {
      where['minDealValueCents'] = { lte: dto.maxDealValueCents };
    }
    if (dto.dealType) {
      where['preferredDealTypes'] = { has: dto.dealType };
    }

    const [items, total] = await Promise.all([
      this.prisma.nilMarketplaceListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ verifiedByPlatform: 'desc' }, { socialFollowersTotal: 'desc' }],
        include: {
          athlete: {
            select: {
              id: true,
              sport: true,
              position: true,
              classYear: true,
              eligibilityStatus: true,
              performanceScore: true,
              fmvMinCents: true,
              fmvMaxCents: true,
              isVerified: true,
              user: {
                select: { id: true, firstName: true, lastName: true, avatarUrl: true },
              },
              university: { select: { name: true, state: true } },
            },
          },
        },
      }),
      this.prisma.nilMarketplaceListing.count({ where }),
    ]);

    // Increment view counts asynchronously
    const ids = items.map((i) => i.id);
    if (ids.length > 0) {
      void this.prisma.nilMarketplaceListing.updateMany({
        where: { id: { in: ids } },
        data: { viewCount: { increment: 1 } },
      });
    }

    return {
      data: items,
      meta: { total, page, limit, pageCount: Math.ceil(total / limit) },
    };
  }

  async getPublicProfile(athleteId: string) {
    const listing = await this.prisma.nilMarketplaceListing.findUnique({
      where: { athleteId },
      include: {
        athlete: {
          select: {
            id: true,
            sport: true,
            position: true,
            classYear: true,
            eligibilityStatus: true,
            performanceScore: true,
            fmvMinCents: true,
            fmvMaxCents: true,
            isVerified: true,
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
            university: { select: { name: true, state: true, division: true } },
          },
        },
      },
    });
    if (!listing || !listing.isVisible) throw new NotFoundException('Listing not found');

    await this.prisma.nilMarketplaceListing.update({
      where: { id: listing.id },
      data: { viewCount: { increment: 1 } },
    });

    return listing;
  }

  async recordInquiry(athleteId: string, brandUserId: string) {
    const listing = await this.prisma.nilMarketplaceListing.findUnique({
      where: { athleteId },
    });
    if (!listing || !listing.isVisible) throw new NotFoundException('Listing not found');

    await this.prisma.nilMarketplaceListing.update({
      where: { id: listing.id },
      data: { inquiryCount: { increment: 1 } },
    });

    await this.auditService.log({
      userId: brandUserId,
      action: 'nil_marketplace.inquiry',
      resource: 'NilMarketplaceListing',
      resourceId: listing.id,
      metadata: { athleteId },
    });

    return { success: true };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async adminVerify(athleteId: string, adminUserId: string) {
    const listing = await this.prisma.nilMarketplaceListing.findUnique({ where: { athleteId } });
    if (!listing) throw new NotFoundException('Listing not found');
    const updated = await this.prisma.nilMarketplaceListing.update({
      where: { athleteId },
      data: { verifiedByPlatform: true },
    });
    await this.auditService.log({
      userId: adminUserId,
      action: 'nil_marketplace.verified',
      resource: 'NilMarketplaceListing',
      resourceId: listing.id,
    });
    return updated;
  }
}
