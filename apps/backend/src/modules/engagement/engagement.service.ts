import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveProfileDto } from './dto/engagement.dto';

type TargetType = 'creator' | 'athlete';

@Injectable()
export class EngagementService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Brand: record a profile view (deduped per brand/target/day) ──────────────

  async recordView(brandUserId: string, targetType: TargetType, targetId: string) {
    const brand = await this.requireBrand(brandUserId);
    const where = this.targetWhere(targetType, targetId);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.prisma.profileView.findFirst({
      where: { brandId: brand.id, ...where, createdAt: { gte: since } },
      select: { id: true },
    });
    if (existing) return { recorded: false, deduped: true };

    await this.prisma.profileView.create({ data: { brandId: brand.id, ...where } });
    return { recorded: true };
  }

  // ── Creator/Athlete: my engagement insights ─────────────────────────────────

  async getMyInsights(userId: string, role: UserRole) {
    const target = await this.resolveSelf(userId, role);
    const where = this.targetWhere(target.type, target.id);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalViews, viewsThisWeek, distinctBrands, savedByCount] = await Promise.all([
      this.prisma.profileView.count({ where }),
      this.prisma.profileView.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
      this.prisma.profileView.groupBy({ by: ['brandId'], where }),
      this.prisma.savedProfile.count({ where }),
    ]);

    return {
      profileViews: totalViews,
      viewsThisWeek,
      uniqueBrands: distinctBrands.length,
      savedByBrands: savedByCount,
    };
  }

  // ── Brand: save / unsave / list shortlist ────────────────────────────────────

  async saveProfile(brandUserId: string, dto: SaveProfileDto) {
    const brand = await this.requireBrand(brandUserId);
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const base = {
      note: dto.note,
      campaignId: dto.campaignId,
    };
    if (dto.targetType === 'creator') {
      return this.prisma.savedProfile.upsert({
        where: { brandId_creatorId: { brandId: brand.id, creatorId: dto.targetId } },
        update: base,
        create: { brandId: brand.id, creatorId: dto.targetId, ...base },
      });
    }
    return this.prisma.savedProfile.upsert({
      where: { brandId_athleteId: { brandId: brand.id, athleteId: dto.targetId } },
      update: base,
      create: { brandId: brand.id, athleteId: dto.targetId, ...base },
    });
  }

  async unsaveProfile(brandUserId: string, targetType: TargetType, targetId: string) {
    const brand = await this.requireBrand(brandUserId);
    await this.prisma.savedProfile.deleteMany({
      where: { brandId: brand.id, ...this.targetWhere(targetType, targetId) },
    });
    return { removed: true };
  }

  async isSaved(brandUserId: string, targetType: TargetType, targetId: string) {
    const brand = await this.requireBrand(brandUserId);
    const count = await this.prisma.savedProfile.count({
      where: { brandId: brand.id, ...this.targetWhere(targetType, targetId) },
    });
    return { saved: count > 0 };
  }

  async listSaved(brandUserId: string, campaignId?: string) {
    const brand = await this.requireBrand(brandUserId);
    const rows = await this.prisma.savedProfile.findMany({
      where: { brandId: brand.id, ...(campaignId ? { campaignId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true, handle: true, city: true, region: true, country: true,
            approxLat: true, approxLng: true, followersCount: true, performanceScore: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        athlete: {
          select: {
            id: true, sport: true, city: true, region: true, country: true,
            approxLat: true, approxLng: true, followersCount: true, performanceScore: true,
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    // Flatten to a uniform, map-ready shape.
    return rows.map((r) => {
      const t = r.creator ?? r.athlete;
      return {
        savedId: r.id,
        targetType: r.creator ? ('creator' as const) : ('athlete' as const),
        targetId: r.creator?.id ?? r.athlete?.id,
        name: t ? `${t.user.firstName} ${t.user.lastName}`.trim() : 'Unknown',
        avatarUrl: t?.user.avatarUrl ?? null,
        subtitle: r.creator ? `@${r.creator.handle}` : r.athlete?.sport,
        location: [t?.city, t?.region].filter(Boolean).join(', ') || t?.country || null,
        approxLat: t?.approxLat ?? null,
        approxLng: t?.approxLng ?? null,
        followersCount: t?.followersCount ?? 0,
        performanceScore: t?.performanceScore ?? 0,
        campaignId: r.campaignId,
        note: r.note,
        savedAt: r.createdAt,
      };
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private targetWhere(targetType: TargetType, targetId: string) {
    return targetType === 'creator' ? { creatorId: targetId } : { athleteId: targetId };
  }

  private async requireBrand(brandUserId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId }, select: { id: true } });
    if (!brand) throw new ForbiddenException('Brand profile required');
    return brand;
  }

  private async resolveSelf(userId: string, role: UserRole): Promise<{ type: TargetType; id: string }> {
    if (role === UserRole.CREATOR) {
      const c = await this.prisma.creator.findUnique({ where: { userId }, select: { id: true } });
      if (!c) throw new NotFoundException('Creator profile not found');
      return { type: 'creator', id: c.id };
    }
    if (role === UserRole.ATHLETE) {
      const a = await this.prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
      if (!a) throw new NotFoundException('Athlete profile not found');
      return { type: 'athlete', id: a.id };
    }
    throw new ForbiddenException('Insights are only available to creators and athletes');
  }

  private async assertTargetExists(targetType: TargetType, targetId: string) {
    const found = targetType === 'creator'
      ? await this.prisma.creator.findUnique({ where: { id: targetId }, select: { id: true } })
      : await this.prisma.athlete.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!found) throw new NotFoundException(`${targetType} not found`);
  }
}
