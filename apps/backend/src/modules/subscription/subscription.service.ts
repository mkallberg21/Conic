import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatorPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { BillingProvider } from './billing.provider';

const PAID_PLANS: CreatorPlan[] = [CreatorPlan.PRO, CreatorPlan.PRO_PLUS];
// Direct-message credits granted per period, by plan (future outreach tier).
const DM_CREDITS: Record<CreatorPlan, number> = {
  [CreatorPlan.FREE]: 0,
  [CreatorPlan.PRO]: 0,
  [CreatorPlan.PRO_PLUS]: 20,
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingProvider,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async getMyPlan(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    const plan = sub?.plan ?? CreatorPlan.FREE;
    const status = sub?.status ?? SubscriptionStatus.ACTIVE;
    return {
      plan,
      status,
      isPro: this.effectivelyPaid(plan, status),
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      dmCredits: sub?.dmCredits ?? 0,
    };
  }

  async startCheckout(userId: string, plan: CreatorPlan) {
    if (plan === CreatorPlan.FREE) {
      await this.setPlan(userId, CreatorPlan.FREE, SubscriptionStatus.ACTIVE);
      return { activated: true, plan };
    }

    const checkout = await this.billing.createCheckout(userId, plan);
    if (checkout.activated) {
      await this.setPlan(userId, plan, SubscriptionStatus.ACTIVE, checkout.providerSubscriptionId);
      return { activated: true, plan };
    }
    return { activated: false, checkoutUrl: checkout.checkoutUrl };
  }

  async cancel(userId: string) {
    await this.setPlan(userId, CreatorPlan.FREE, SubscriptionStatus.CANCELED);
    return this.getMyPlan(userId);
  }

  async handleWebhook(headers: Record<string, string>, raw: Buffer) {
    const secret = this.config.get<string>('billing.stripeWebhookSecret');
    if (this.billing.isLive && secret && headers['x-billing-secret'] !== secret) {
      throw new ForbiddenException('Invalid billing webhook signature');
    }
    const evt = this.billing.parseWebhook(headers, raw);
    const sub = await this.prisma.subscription.findUnique({ where: { providerSubscriptionId: evt.providerSubscriptionId } });
    if (!sub) {
      this.logger.warn(`Billing webhook for unknown subscription ${evt.providerSubscriptionId}`);
      return { ok: true };
    }
    const plan = evt.active ? evt.plan ?? sub.plan : CreatorPlan.FREE;
    const status = evt.active ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELED;
    await this.setPlan(sub.userId, plan, status, evt.providerSubscriptionId);
    return { ok: true };
  }

  // ── Gating ─────────────────────────────────────────────────────────────────

  async isPro(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });
    return this.effectivelyPaid(sub?.plan ?? CreatorPlan.FREE, sub?.status ?? SubscriptionStatus.ACTIVE);
  }

  async assertPro(userId: string): Promise<void> {
    if (!(await this.isPro(userId))) {
      throw new ForbiddenException('This is a Pro feature — upgrade your plan to unlock it.');
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private effectivelyPaid(plan: CreatorPlan, status: SubscriptionStatus): boolean {
    return PAID_PLANS.includes(plan) && status === SubscriptionStatus.ACTIVE;
  }

  private async setPlan(
    userId: string,
    plan: CreatorPlan,
    status: SubscriptionStatus,
    providerSubscriptionId?: string,
  ) {
    const paid = this.effectivelyPaid(plan, status);
    const currentPeriodEnd = paid ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

    const data = {
      plan,
      status,
      provider: this.billing.name,
      providerSubscriptionId,
      currentPeriodEnd,
      dmCredits: paid ? DM_CREDITS[plan] : 0,
    };
    await this.prisma.subscription.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    // Denormalize onto the creator/athlete profile for fast gating + discovery boost.
    await Promise.all([
      this.prisma.creator.updateMany({ where: { userId }, data: { isPro: paid } }),
      this.prisma.athlete.updateMany({ where: { userId }, data: { isPro: paid } }),
    ]);

    void this.audit.log({
      userId,
      action: paid ? 'SUBSCRIPTION_ACTIVATED' : 'SUBSCRIPTION_CANCELED',
      resource: 'Subscription',
      resourceId: userId,
      newValue: { plan, status },
    });
  }
}
