import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SocialPlatform } from '@prisma/client';

export interface VerifierChallenge {
  method: string;
  verificationCode: string;
  instructions: string;
}

/**
 * Pluggable ownership-verification strategy for a linked social account.
 * The default implementation issues an ownership code the creator/athlete must
 * place in their public bio. Actually reading the public profile to confirm the
 * code (or doing OAuth) requires each platform's API credentials and is
 * therefore credential-gated — see docs/PRODUCTION_READINESS.md. Swap in a real
 * verifier per platform when those credentials are available.
 */
export interface SocialVerifier {
  begin(platform: SocialPlatform, handle: string): VerifierChallenge;
  /** Returns true once ownership is confirmed. Stub returns false (needs live API creds). */
  check(platform: SocialPlatform, handle: string, verificationCode: string): Promise<boolean>;
}

@Injectable()
export class OwnershipCodeVerifier implements SocialVerifier {
  private readonly logger = new Logger(OwnershipCodeVerifier.name);

  begin(platform: SocialPlatform, handle: string): VerifierChallenge {
    const verificationCode = `conic-verify-${randomBytes(4).toString('hex')}`;
    return {
      method: 'ownership_code',
      verificationCode,
      instructions:
        `Add "${verificationCode}" to your ${platform} bio for @${handle}, then request verification. ` +
        `Once confirmed you can remove it.`,
    };
  }

  async check(platform: SocialPlatform, handle: string, _verificationCode: string): Promise<boolean> {
    // A live implementation fetches the public profile for `handle` on `platform`
    // and checks that the bio contains verificationCode. That requires the
    // platform's API token (credential-gated), so we cannot auto-confirm here.
    this.logger.warn(
      `Ownership check for ${platform}/@${handle} skipped — live platform API credentials required.`,
    );
    return false;
  }
}
