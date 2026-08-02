import { Body, Controller, ForbiddenException, Headers, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { AgeVerificationService } from './age-verification.service';
import { BusinessVerificationService } from './business-verification.service';

/**
 * Public verification webhooks. Guarded by a shared secret compared in constant
 * time. When a real vendor is wired, swap this for its signed-payload HMAC check
 * over the raw request body.
 */
@ApiExcludeController()
@Controller('verification/webhooks')
export class VerificationWebhooksController {
  constructor(
    private readonly age: AgeVerificationService,
    private readonly kyb: BusinessVerificationService,
    private readonly config: ConfigService,
  ) {}

  @Post('age')
  ageWebhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    this.assertSignature(headers);
    return this.age.handleWebhook(headers, Buffer.from(JSON.stringify(body ?? {})));
  }

  @Post('kyb')
  kybWebhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    this.assertSignature(headers);
    return this.kyb.handleWebhook(headers, Buffer.from(JSON.stringify(body ?? {})));
  }

  private assertSignature(headers: Record<string, string>): void {
    const secret = this.config.get<string>('verification.webhookSecret');
    if (!secret) {
      // Fail closed — never accept unauthenticated verification callbacks.
      throw new ServiceUnavailableException('Verification webhooks are not configured');
    }
    const provided = headers['x-verification-secret'] ?? '';
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
  }
}
