import { ForbiddenException, Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ApplicationStatus, BriefStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApplyDto, CreateBriefDto, RespondApplicationDto } from './dto/marketplace.dto';

type TargetType = 'creator' | 'athlete';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Brand: post & manage briefs ─────────────────────────────────────────────

  async createBrief(brandUserId: string, dto: CreateBriefDto) {
    const brand = await this.requireBrand(brandUserId);
    const brief = await this.prisma.marketplaceBrief.create({
      data: {
        brandId: brand.id,
        campaignId: dto.campaignId,
        title: dto.title,
        description: dto.description,
        budgetCents: dto.budgetCents,
        deliverableType: dto.deliverableType,
        platforms: dto.platforms ?? [],
        niche: dto.niche ?? [],
        sport: dto.sport,
        targetType: dto.targetType ?? 'both',
        minFollowers: dto.minFollowers,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
    void this.audit.log({ userId: brandUserId, action: 'BRIEF_CREATED', resource: 'MarketplaceBrief', resourceId: brief.id });
    return brief;
  }

  async listMyBriefs(brandUserId: string) {
    const brand = await this.requireBrand(brandUserId);
    return this.prisma.marketplaceBrief.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  async closeBrief(brandUserId: string, briefId: string) {
    const brand = await this.requireBrand(brandUserId);
    const brief = await this.prisma.marketplaceBrief.findUnique({ where: { id: briefId } });
    if (!brief || brief.brandId !== brand.id) throw new NotFoundException('Brief not found');
    return this.prisma.marketplaceBrief.update({ where: { id: briefId }, data: { status: BriefStatus.CLOSED } });
  }

  async listApplications(brandUserId: string, briefId: string) {
    const brand = await this.requireBrand(brandUserId);
    const brief = await this.prisma.marketplaceBrief.findUnique({ where: { id: briefId } });
    if (!brief || brief.brandId !== brand.id) throw new NotFoundException('Brief not found');
    return this.prisma.briefApplication.findMany({
      where: { briefId },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { id: true, handle: true, followersCount: true, performanceScore: true, isPro: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        athlete: { select: { id: true, sport: true, followersCount: true, performanceScore: true, isPro: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });
  }

  async respondToApplication(brandUserId: string, applicationId: string, dto: RespondApplicationDto) {
    const brand = await this.requireBrand(brandUserId);
    const app = await this.prisma.briefApplication.findUnique({
      where: { id: applicationId },
      include: { brief: true },
    });
    if (!app || app.brief.brandId !== brand.id) throw new NotFoundException('Application not found');
    if (app.status === ApplicationStatus.WITHDRAWN) throw new BadRequestException('The applicant withdrew.');

    const status = dto.decision as ApplicationStatus;
    const updated = await this.prisma.briefApplication.update({ where: { id: applicationId }, data: { status } });

    // Accepting an applicant marks the brief filled — the brand then drafts a
    // contract with them through the normal flow.
    if (status === ApplicationStatus.ACCEPTED) {
      await this.prisma.marketplaceBrief.update({ where: { id: app.briefId }, data: { status: BriefStatus.FILLED } });
    }
    void this.audit.log({ userId: brandUserId, action: `APPLICATION_${status}`, resource: 'BriefApplication', resourceId: applicationId });
    return updated;
  }

  // ── Creator / athlete: browse & apply ───────────────────────────────────────

  async browseBriefs(userId: string, role: UserRole) {
    const self = await this.resolveSelf(userId, role);
    const where: Prisma.MarketplaceBriefWhereInput = {
      status: BriefStatus.OPEN,
      OR: [{ targetType: 'both' }, { targetType: self.type }],
    };
    const briefs = await this.prisma.marketplaceBrief.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { brand: { select: { companyName: true, logoUrl: true, industry: true } } },
    });

    // Mark which ones this user already applied to.
    const applied = await this.prisma.briefApplication.findMany({
      where: this.selfWhere(self),
      select: { briefId: true, status: true },
    });
    const appliedMap = new Map(applied.map((a) => [a.briefId, a.status]));
    return briefs.map((b) => ({ ...b, myApplicationStatus: appliedMap.get(b.id) ?? null }));
  }

  async apply(userId: string, role: UserRole, briefId: string, dto: ApplyDto) {
    const self = await this.resolveSelf(userId, role);
    const brief = await this.prisma.marketplaceBrief.findUnique({ where: { id: briefId } });
    if (!brief) throw new NotFoundException('Brief not found');
    if (brief.status !== BriefStatus.OPEN) throw new BadRequestException('This opportunity is no longer open.');
    if (brief.targetType !== 'both' && brief.targetType !== self.type) {
      throw new ForbiddenException('This opportunity isn’t open to your account type.');
    }

    try {
      const app = await this.prisma.briefApplication.create({
        data: {
          briefId,
          creatorId: self.type === 'creator' ? self.id : null,
          athleteId: self.type === 'athlete' ? self.id : null,
          pitch: dto.pitch,
          proposedRateCents: dto.proposedRateCents,
        },
      });
      void this.audit.log({ userId, action: 'BRIEF_APPLIED', resource: 'BriefApplication', resourceId: app.id });
      return app;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You’ve already applied to this opportunity.');
      }
      throw err;
    }
  }

  async withdraw(userId: string, role: UserRole, applicationId: string) {
    const self = await this.resolveSelf(userId, role);
    const app = await this.prisma.briefApplication.findUnique({ where: { id: applicationId } });
    const ownerId = self.type === 'creator' ? app?.creatorId : app?.athleteId;
    if (!app || ownerId !== self.id) throw new NotFoundException('Application not found');
    return this.prisma.briefApplication.update({ where: { id: applicationId }, data: { status: ApplicationStatus.WITHDRAWN } });
  }

  async myApplications(userId: string, role: UserRole) {
    const self = await this.resolveSelf(userId, role);
    return this.prisma.briefApplication.findMany({
      where: this.selfWhere(self),
      orderBy: { createdAt: 'desc' },
      include: { brief: { include: { brand: { select: { companyName: true, logoUrl: true } } } } },
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private selfWhere(self: { type: TargetType; id: string }) {
    return self.type === 'creator' ? { creatorId: self.id } : { athleteId: self.id };
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
    throw new ForbiddenException('Only creators and athletes can apply to opportunities');
  }
}
