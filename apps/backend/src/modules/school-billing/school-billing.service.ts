import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstitutionPlan, SubscriptionStatus, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { INSTITUTION_ENTITLEMENTS } from './entitlements';

const FLAG_RISK_THRESHOLD = 60;

@Injectable()
export class SchoolBillingService {
  private readonly logger = new Logger(SchoolBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get live(): boolean {
    return this.config.get<string>('billing.provider') === 'stripe' && !!this.config.get<string>('billing.stripeSecretKey');
  }

  /** The university a compliance officer belongs to (null for other roles). */
  async myUniversity(userId: string, role: UserRole) {
    if (role === UserRole.COMPLIANCE_OFFICER) {
      const co = await this.prisma.complianceOfficer.findUnique({
        where: { userId },
        select: { university: { select: { id: true, name: true, shortName: true } } },
      });
      return co?.university ?? null;
    }
    return null;
  }

  /** Access gate: officers must own the university; admins pass any. */
  async assertAccess(userId: string, role: UserRole, universityId: string) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.COMPLIANCE_OFFICER) {
      const co = await this.prisma.complianceOfficer.findUnique({ where: { userId }, select: { universityId: true } });
      if (co?.universityId !== universityId) throw new ForbiddenException('Not your institution');
      return;
    }
    // UNIVERSITY_ADMIN / ATHLETIC_DIRECTOR — no explicit link in the schema yet;
    // allowed, consistent with the existing university endpoints.
    if (role === UserRole.UNIVERSITY_ADMIN || role === UserRole.ATHLETIC_DIRECTOR) return;
    throw new ForbiddenException('Institution access required');
  }

  // ── Billing ────────────────────────────────────────────────────────────────

  async getPlan(universityId: string) {
    const [sub, athletes] = await Promise.all([
      this.prisma.schoolSubscription.findUnique({ where: { universityId } }),
      this.prisma.athlete.count({ where: { universityId } }),
    ]);
    const plan = sub?.plan ?? InstitutionPlan.NONE;
    return {
      plan,
      status: sub?.status ?? SubscriptionStatus.ACTIVE,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      entitlements: INSTITUTION_ENTITLEMENTS[plan],
      usage: { athletes },
      catalog: INSTITUTION_ENTITLEMENTS,
    };
  }

  async startCheckout(universityId: string, plan: InstitutionPlan) {
    if (plan === InstitutionPlan.NONE) {
      await this.setPlan(universityId, InstitutionPlan.NONE, SubscriptionStatus.ACTIVE);
      return { activated: true, plan };
    }
    if (this.live) {
      this.logger.warn('Live school billing configured but Stripe client is not wired; returning success URL.');
      return { activated: false, checkoutUrl: this.config.get<string>('billing.checkoutSuccessUrl') };
    }
    await this.setPlan(universityId, plan, SubscriptionStatus.ACTIVE, `ssub_${randomBytes(10).toString('hex')}`);
    return { activated: true, plan };
  }

  async cancel(universityId: string) {
    await this.setPlan(universityId, InstitutionPlan.NONE, SubscriptionStatus.CANCELED);
    return this.getPlan(universityId);
  }

  // ── Compliance command-center ────────────────────────────────────────────────

  async getComplianceOverview(universityId: string) {
    const [athletes, activeDeals, flaggedDeals, groups, recent] = await Promise.all([
      this.prisma.athlete.count({ where: { universityId } }),
      this.prisma.nilDeal.count({ where: { athlete: { universityId }, status: { in: ['PENDING', 'ACTIVE'] } } }),
      this.prisma.nilDeal.count({ where: { athlete: { universityId }, aiRiskScore: { gte: FLAG_RISK_THRESHOLD } } }),
      this.prisma.nilDisclosure.groupBy({ by: ['status'], where: { universityId }, _count: { _all: true } }),
      this.prisma.nilDisclosure.findMany({
        where: { universityId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true, brandName: true, dealType: true, status: true, createdAt: true,
          athlete: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
    ]);

    const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
    const totalDisclosures = groups.reduce((s, g) => s + g._count._all, 0);
    const approved = byStatus['APPROVED'] ?? 0;
    const pending = byStatus['PENDING_REVIEW'] ?? 0;

    return {
      athletes,
      activeDeals,
      flaggedDeals,
      disclosures: {
        total: totalDisclosures,
        pending,
        approved,
        // Approved share of decided disclosures — the compliance "health" number.
        complianceRate: totalDisclosures ? Math.round((approved / totalDisclosures) * 100) : 100,
      },
      recent: recent.map((d) => ({
        id: d.id,
        athlete: `${d.athlete.user.firstName} ${d.athlete.user.lastName}`.trim(),
        brandName: d.brandName,
        dealType: d.dealType,
        status: d.status,
        createdAt: d.createdAt,
      })),
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  async handleWebhook(headers: Record<string, string>, raw: Buffer) {
    const secret = this.config.get<string>('billing.stripeWebhookSecret');
    if (this.live && secret && headers['x-billing-secret'] !== secret) {
      throw new ForbiddenException('Invalid billing webhook signature');
    }
    const body = JSON.parse(raw.toString('utf8')) as { providerSubscriptionId: string; plan?: InstitutionPlan; status?: string };
    const sub = await this.prisma.schoolSubscription.findUnique({ where: { providerSubscriptionId: body.providerSubscriptionId } });
    if (!sub) return { ok: true };
    const active = (body.status ?? '').toLowerCase() === 'active';
    await this.setPlan(
      sub.universityId,
      active ? body.plan ?? sub.plan : InstitutionPlan.NONE,
      active ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELED,
      body.providerSubscriptionId,
    );
    return { ok: true };
  }

  private async setPlan(universityId: string, plan: InstitutionPlan, status: SubscriptionStatus, providerSubscriptionId?: string) {
    const university = await this.prisma.university.findUnique({ where: { id: universityId }, select: { id: true } });
    if (!university) throw new NotFoundException('University not found');
    const paid = plan !== InstitutionPlan.NONE && status === SubscriptionStatus.ACTIVE;
    const data = {
      plan,
      status,
      provider: this.live ? 'stripe' : 'stub',
      providerSubscriptionId,
      currentPeriodEnd: paid ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
    };
    await this.prisma.schoolSubscription.upsert({
      where: { universityId },
      update: data,
      create: { universityId, ...data },
    });
    void this.audit.log({
      action: paid ? 'SCHOOL_PLAN_ACTIVATED' : 'SCHOOL_PLAN_CANCELED',
      resource: 'SchoolSubscription',
      resourceId: universityId,
      newValue: { plan, status },
    });
  }
}
