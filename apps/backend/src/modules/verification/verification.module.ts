import { Global, Module } from '@nestjs/common';
import { AgeAssuranceProvider } from './providers/age-assurance.provider';
import { BusinessVerifier } from './providers/business-verifier';
import { AgeVerificationService } from './age-verification.service';
import { BusinessVerificationService } from './business-verification.service';
import { EligibilityService } from './eligibility.service';
import { VerificationController } from './verification.controller';
import { VerificationWebhooksController } from './verification-webhooks.controller';

// Global so agreement / payout / discovery / first-contact flows can inject
// EligibilityService for capability gating without re-importing the module.
@Global()
@Module({
  providers: [
    AgeAssuranceProvider,
    BusinessVerifier,
    AgeVerificationService,
    BusinessVerificationService,
    EligibilityService,
  ],
  controllers: [VerificationController, VerificationWebhooksController],
  exports: [AgeVerificationService, BusinessVerificationService, EligibilityService],
})
export class VerificationModule {}
