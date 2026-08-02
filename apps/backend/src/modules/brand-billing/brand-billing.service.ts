import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrandPlan, CampaignStatus, SubscriptionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { BRAND_ENTITLEMENTS, Entitlements } from './entitlements';

@Injectable()
export class BrandBillingService {
  private readonly logger = new Logger(BrandBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get live(): boolean {
    return this.config.get<string>('billing.provider') === 'stripe' && !!this.config.get<string>('billing.stripeSecretKey');
  }

  async getMyPlan(brandUserId: string) {
    const brand = await this.requireBrand(brandUserId);
    const [sub, activeCampaigns] = await Promise.all([
      this.prisma.brandSubscription.findUnique({ where: { brandId: brand.id } }),
      this.prisma.campaign.count({ where: { brandId: brand.id, status: CampaignStatus.ACTIVE, deletedAt: null } }),
    ]);
    const plan = sub?.plan ?? BrandPlan.FREE;
    return {
      plan,
      status: sub?.status ?? SubscriptionStatus.ACTIVE,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      entitlements: BRAND_ENTITLEMENTS[plan],
      usage: { activeCampaigns },
      catalog: BRAND_ENTITLEMENTS,
    };
  }

  async startCheckout(brandUserId: string, plan: BrandPlan) {
    if (plan === BrandPlan.FREE) {
      await this.setPlan(brandUserId, BrandPlan.FREE, SubscriptionStatus.ACTIVE);
      return { activated: true, plan };
    }
    const providerSubscriptionId = `bsub_${randomBytes(10).toString('hex')}`;
    if (this.live) {
      // Real Stripe checkout session (credential-gated); completes via webhook.
      this.logger.warn('Live brand billing configured but Stripe client is not wired; returning success URL.');
      return { activated: false, checkoutUrl: this.config.get<string>('billing.checkoutSuccessUrl') };
    }
    await this.setPlan(brandUserId, plan, SubscriptionStatus.ACTIVE, providerSubscriptionId);
    return { activated: true, plan };
  }

  async cancel(brandUserId: string) {
    await this.setPlan(brandUserId, BrandPlan.FREE, SubscriptionStatus.CANCELED);
    return this.getMyPlan(brandUserId);
  }

  async handleWebhook(headers: Record<string, string>, raw: Buffer) {
    const secret = this.config.get<string>('billing.stripeWebhookSecret');
    if (this.live && secret && headers['x-billing-secret'] !== secret) {
      throw new ForbiddenException('Invalid billing webhook signature');
    }
    const body = JSON.parse(raw.toString('utf8')) as { providerSubscriptionId: string; plan?: BrandPlan; status?: string };
    const sub = await this.prisma.brandSubscription.findUnique({ where: { providerSubscriptionId: body.providerSubscriptionId } });
    if (!sub) {
      this.logger.warn(`Brand billing webhook for unknown subscription ${body.providerSubscriptionId}`);
      return { ok: true };
    }
    const active = (body.status ?? '').toLowerCase() === 'active';
    const brand = await this.prisma.brand.findUnique({ where: { id: sub.brandId }, select: { userId: true } });
    if (brand) {
      await this.setPlan(
        brand.userId,
        active ? body.plan ?? sub.plan : BrandPlan.FREE,
        active ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELED,
        body.providerSubscriptionId,
      );
    }
    return { ok: true };
  }

  // ── Entitlement gating ─────────────────────────────────────────────────────

  async getEntitlements(brandUserId: string): Promise<Entitlements> {
    const brand = await this.requireBrand(brandUserId);
    const sub = await this.prisma.brandSubscription.findUnique({ where: { brandId: brand.id }, select: { plan: true } });
    return BRAND_ENTITLEMENTS[sub?.plan ?? BrandPlan.FREE];
  }

  /**
   * Enforces the plan's active-campaign limit. Log-only until ENFORCE_BRAND_LIMITS
   * is turned on, so existing brands aren't blocked mid-flight.
   */
  async assertWithinCampaignLimit(brandUserId: string): Promise<void> {
    const brand = await this.requireBrand(brandUserId);
    const sub = await this.prisma.brandSubscription.findUnique({ where: { brandId: brand.id }, select: { plan: true } });
    const limit = BRAND_ENTITLEMENTS[sub?.plan ?? BrandPlan.FREE].activeCampaigns;
    const active = await this.prisma.campaign.count({ where: { brandId: brand.id, status: CampaignStatus.ACTIVE, deletedAt: null } });
    if (active >= limit) {
      const msg = `You've reached your plan's limit of ${limit} active campaigns. Upgrade to run more.`;
      if (this.config.get<boolean>('billing.enforceBrandLimits')) throw new ForbiddenException(msg);
      this.logger.warn(`[brand-limit log-only] ${brandUserId}: ${msg}`);
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private async requireBrand(brandUserId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId }, select: { id: true } });
    if (!brand) throw new ForbiddenException('Brand profile required');
    return brand;
  }

  private async setPlan(brandUserId: string, plan: BrandPlan, status: SubscriptionStatus, providerSubscriptionId?: string) {
    const brand = await this.requireBrand(brandUserId);
    const paid = plan !== BrandPlan.FREE && status === SubscriptionStatus.ACTIVE;
    const data = {
      plan,
      status,
      provider: this.live ? 'stripe' : 'stub',
      providerSubscriptionId,
      currentPeriodEnd: paid ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
    };
    await this.prisma.brandSubscription.upsert({
      where: { brandId: brand.id },
      update: data,
      create: { brandId: brand.id, ...data },
    });
    void this.audit.log({
      userId: brandUserId,
      action: paid ? 'BRAND_PLAN_ACTIVATED' : 'BRAND_PLAN_CANCELED',
      resource: 'BrandSubscription',
      resourceId: brand.id,
      newValue: { plan, status },
    });
  }
}
