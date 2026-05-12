/**
 * SecurityTokenService
 *
 * Provides safe generation and verification of single-use security tokens
 * (email verification, password reset) using HMAC-SHA256 blind hashing.
 *
 * Only the hash is persisted in the database. The raw token is sent to the
 * user via email. A stolen database cannot produce valid tokens.
 *
 * Usage:
 *   const rawToken = SecurityTokenService.generate();       // send via email
 *   const hash     = SecurityTokenService.hash(rawToken);   // store in DB
 *   const valid    = SecurityTokenService.verify(rawToken, storedHash); // on redemption
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityTokenService {
  private readonly secret: Buffer;

  constructor(private readonly config: ConfigService) {
    const raw =
      config.get<string>('jwt.refreshSecret') ??
      config.get<string>('jwt.secret') ??
      'insecure-dev-token-secret';
    this.secret = Buffer.from(raw, 'hex').length === 32
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'utf8');
  }

  /** Generate a cryptographically random URL-safe token (48 bytes → 96 hex chars). */
  generate(): string {
    return randomBytes(48).toString('hex');
  }

  /**
   * HMAC-SHA256 the token before storing.
   * Stored form is NOT reversible back to the raw token.
   */
  hash(rawToken: string): string {
    return createHmac('sha256', this.secret).update(rawToken).digest('hex');
  }

  /**
   * Timing-safe comparison of a user-supplied raw token against a stored hash.
   * Returns true only if they match.
   */
  verify(rawToken: string, storedHash: string): boolean {
    const expected = this.hash(rawToken);
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(storedHash, 'hex'));
    } catch {
      return false;
    }
  }
}
