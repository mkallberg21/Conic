import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgeCheckMethod, IdentityStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface AgeStartContext {
  userId: string;
  method: AgeCheckMethod;
  /** Self-reported DOB — used only by the stub to synthesize a result in dev. */
  selfReportedDob?: Date | null;
  minorAgeThreshold: number;
}

export interface AgeResult {
  status: IdentityStatus;
  isAdult?: boolean;
  estimatedAge?: number;
  confirmedDob?: Date | null;
  docType?: string;
  docCountry?: string;
  reason?: string;
}

export interface AgeStartResult {
  sessionId: string;
  clientToken?: string;
  redirectUrl?: string;
  result: AgeResult;
}

/**
 * Age-assurance provider. Real vendors (facial age-estimation or document +
 * selfie) are switched on when AGE_API_KEY is set; otherwise the credential-gated
 * stub resolves synchronously from the user's self-reported DOB so the whole
 * flow is testable in dev without leaking anything or calling out.
 */
@Injectable()
export class AgeAssuranceProvider {
  private readonly logger = new Logger(AgeAssuranceProvider.name);
  private readonly live: boolean;

  constructor(private readonly config: ConfigService) {
    this.live =
      this.config.get<string>('verification.ageProvider') === 'vendor' &&
      !!this.config.get<string>('verification.ageApiKey');
  }

  get name(): string {
    return this.live ? 'vendor' : 'stub';
  }
  get isLive(): boolean {
    return this.live;
  }

  async start(ctx: AgeStartContext): Promise<AgeStartResult> {
    const sessionId = `age_${randomBytes(12).toString('hex')}`;

    if (this.live) {
      // A real vendor returns a hosted-capture token/URL and completes async via
      // webhook. Wiring the specific vendor SDK is credential-gated and lives here.
      this.logger.warn('Live age provider configured but vendor client is not wired; returning PENDING.');
      return { sessionId, result: { status: IdentityStatus.PENDING } };
    }

    // Stub: no real assurance — echo the self-reported DOB as "confirmed" so the
    // downstream reconciliation (isMinor, guardian) is exercised end-to-end.
    if (!ctx.selfReportedDob) {
      return { sessionId, result: { status: IdentityStatus.NEEDS_INPUT, reason: 'No date of birth on file' } };
    }
    const age = ageInYears(ctx.selfReportedDob);
    return {
      sessionId,
      result: {
        status: IdentityStatus.APPROVED,
        isAdult: age >= ctx.minorAgeThreshold,
        estimatedAge: age,
        confirmedDob: ctx.method === AgeCheckMethod.DOCUMENT ? ctx.selfReportedDob : null,
        docCountry: ctx.method === AgeCheckMethod.DOCUMENT ? 'US' : undefined,
      },
    };
  }

  /** Normalize a vendor webhook into an AgeResult keyed by our session id. */
  parseWebhook(_headers: Record<string, string>, raw: Buffer): { sessionId: string; result: AgeResult } {
    const body = JSON.parse(raw.toString('utf8')) as {
      sessionId: string;
      decision?: string;
      isAdult?: boolean;
      estimatedAge?: number;
      dob?: string;
      docType?: string;
      docCountry?: string;
      reason?: string;
    };
    return {
      sessionId: body.sessionId,
      result: {
        status: mapDecision(body.decision),
        isAdult: body.isAdult,
        estimatedAge: body.estimatedAge,
        confirmedDob: body.dob ? new Date(body.dob) : undefined,
        docType: body.docType,
        docCountry: body.docCountry,
        reason: body.reason,
      },
    };
  }
}

function mapDecision(decision?: string): IdentityStatus {
  switch ((decision ?? '').toLowerCase()) {
    case 'approved':
    case 'pass':
      return IdentityStatus.APPROVED;
    case 'declined':
    case 'fail':
      return IdentityStatus.DECLINED;
    case 'review':
    case 'manual_review':
      return IdentityStatus.REVIEW;
    case 'needs_input':
    case 'resubmit':
      return IdentityStatus.NEEDS_INPUT;
    default:
      return IdentityStatus.PENDING;
  }
}

function ageInYears(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
