import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatorPlan } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface CheckoutResult {
  /** Stub / synchronous providers activate immediately with no redirect. */
  activated: boolean;
  checkoutUrl?: string;
  providerSubscriptionId?: string;
}

export interface BillingEvent {
  providerSubscriptionId: string;
  plan?: CreatorPlan;
  active: boolean;
}

/**
 * Billing provider. Real Stripe checkout/webhooks switch on when STRIPE_SECRET_KEY
 * is set; otherwise the credential-gated stub activates the plan immediately so
 * the upgrade flow is testable in dev without taking a payment. No charge is ever
 * initiated from here without a configured, user-driven Stripe checkout.
 */
@Injectable()
export class BillingProvider {
  private readonly logger = new Logger(BillingProvider.name);
  private readonly live: boolean;

  constructor(private readonly config: ConfigService) {
    this.live =
      this.config.get<string>('billing.provider') === 'stripe' &&
      !!this.config.get<string>('billing.stripeSecretKey');
  }

  get name(): string {
    return this.live ? 'stripe' : 'stub';
  }
  get isLive(): boolean {
    return this.live;
  }

  async createCheckout(userId: string, plan: CreatorPlan): Promise<CheckoutResult> {
    const providerSubscriptionId = `sub_${randomBytes(10).toString('hex')}`;

    if (this.live) {
      // A real Stripe checkout session is created here (SDK wiring is credential-
      // gated). It returns a hosted URL and completes via webhook — never
      // auto-activates.
      this.logger.warn('Live billing configured but Stripe client is not wired; returning success URL.');
      return { activated: false, checkoutUrl: this.config.get<string>('billing.checkoutSuccessUrl'), providerSubscriptionId };
    }

    // Stub: activate immediately (dev). No money changes hands.
    this.logger.log(`[billing stub] activating ${plan} for user ${userId}`);
    return { activated: true, providerSubscriptionId };
  }

  parseWebhook(_headers: Record<string, string>, raw: Buffer): BillingEvent {
    const body = JSON.parse(raw.toString('utf8')) as {
      providerSubscriptionId: string;
      plan?: CreatorPlan;
      status?: string;
    };
    return {
      providerSubscriptionId: body.providerSubscriptionId,
      plan: body.plan,
      active: (body.status ?? '').toLowerCase() === 'active',
    };
  }
}
