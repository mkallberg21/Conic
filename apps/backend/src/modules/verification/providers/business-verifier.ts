import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityStatus, KybTier } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface KybInput {
  brandId: string;
  legalName: string;
  registrationNumber?: string;
  country: string;
  domain?: string;
  tier: KybTier;
}

export interface KybResult {
  status: IdentityStatus;
  matchedName?: string;
  riskScore?: number;
  sanctionsHit?: boolean;
  beneficialOwnersOk?: boolean;
  reason?: string;
}

export interface KybSubmitResult {
  caseId: string;
  result: KybResult;
}

/**
 * Know-your-business verifier. A real vendor performs a business-registry match
 * plus sanctions/PEP and beneficial-owner screening; wiring it is credential-gated
 * on KYB_API_KEY. The stub approves BASIC synchronously and holds ENHANCED for
 * review, so the tier logic is exercised in dev without an external call.
 */
@Injectable()
export class BusinessVerifier {
  private readonly logger = new Logger(BusinessVerifier.name);
  private readonly live: boolean;

  constructor(private readonly config: ConfigService) {
    this.live =
      this.config.get<string>('verification.kybProvider') === 'vendor' &&
      !!this.config.get<string>('verification.kybApiKey');
  }

  get name(): string {
    return this.live ? 'vendor' : 'stub';
  }
  get isLive(): boolean {
    return this.live;
  }

  async submit(input: KybInput): Promise<KybSubmitResult> {
    const caseId = `kyb_${randomBytes(12).toString('hex')}`;

    if (this.live) {
      this.logger.warn('Live KYB provider configured but vendor client is not wired; returning PENDING.');
      return { caseId, result: { status: IdentityStatus.PENDING } };
    }

    // Stub: BASIC auto-approves; ENHANCED (the minor-contact tier) always routes
    // to human review — the safe default when there is no real screening.
    if (input.tier === KybTier.ENHANCED) {
      return {
        caseId,
        result: {
          status: IdentityStatus.REVIEW,
          matchedName: input.legalName,
          reason: 'Enhanced (minor-contact) tier requires manual review without a live provider',
        },
      };
    }
    return {
      caseId,
      result: {
        status: IdentityStatus.APPROVED,
        matchedName: input.legalName,
        riskScore: 10,
        sanctionsHit: false,
        beneficialOwnersOk: false,
      },
    };
  }

  parseWebhook(_headers: Record<string, string>, raw: Buffer): { caseId: string; result: KybResult } {
    const body = JSON.parse(raw.toString('utf8')) as {
      caseId: string;
      decision?: string;
      matchedName?: string;
      riskScore?: number;
      sanctionsHit?: boolean;
      beneficialOwnersOk?: boolean;
      reason?: string;
    };
    return {
      caseId: body.caseId,
      result: {
        status: mapDecision(body.decision),
        matchedName: body.matchedName,
        riskScore: body.riskScore,
        sanctionsHit: body.sanctionsHit,
        beneficialOwnersOk: body.beneficialOwnersOk,
        reason: body.reason,
      },
    };
  }
}

function mapDecision(decision?: string): IdentityStatus {
  switch ((decision ?? '').toLowerCase()) {
    case 'approved':
    case 'clear':
      return IdentityStatus.APPROVED;
    case 'declined':
    case 'fail':
      return IdentityStatus.DECLINED;
    case 'review':
    case 'consider':
      return IdentityStatus.REVIEW;
    default:
      return IdentityStatus.PENDING;
  }
}
