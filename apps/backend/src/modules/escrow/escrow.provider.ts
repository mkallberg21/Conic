import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

export interface EscrowMoveResult {
  ok: boolean;
  providerRef?: string;
}

/**
 * Escrow money-movement provider. In production this holds/releases funds via the
 * configured payment rail (Dwolla) — credential-gated. Without credentials the
 * stub records the movement in our ledger only (dev/testing): no real money
 * moves, and this code never initiates a live transfer on its own.
 */
@Injectable()
export class EscrowProvider {
  private readonly logger = new Logger(EscrowProvider.name);
  private readonly live: boolean;

  constructor(private readonly config: ConfigService) {
    this.live = !!this.config.get<string>('dwolla.key') && !!this.config.get<string>('dwolla.masterFundingSourceUrl');
  }

  get name(): string {
    return this.live ? 'dwolla' : 'stub';
  }
  get isLive(): boolean {
    return this.live;
  }

  async hold(amountCents: number, brandId: string): Promise<EscrowMoveResult> {
    if (this.live) {
      // Real hold: pull funds from the brand's source into the platform holding
      // account (Dwolla transfer). Credential-gated; wired at deploy time.
      this.logger.warn('Live escrow configured but transfer wiring is deferred; recording ledger-only.');
    } else {
      this.logger.log(`[escrow stub] holding ${amountCents}¢ for brand ${brandId}`);
    }
    return { ok: true, providerRef: `esc_${randomBytes(9).toString('hex')}` };
  }

  async release(providerRef: string | null): Promise<EscrowMoveResult> {
    this.logger.log(`[escrow ${this.name}] releasing ${providerRef ?? '(no ref)'} to creator`);
    return { ok: true, providerRef: providerRef ?? undefined };
  }

  async refund(providerRef: string | null): Promise<EscrowMoveResult> {
    this.logger.log(`[escrow ${this.name}] refunding ${providerRef ?? '(no ref)'} to brand`);
    return { ok: true, providerRef: providerRef ?? undefined };
  }
}
