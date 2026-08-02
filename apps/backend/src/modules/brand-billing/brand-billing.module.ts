import { Global, Module } from '@nestjs/common';
import { BrandBillingService } from './brand-billing.service';
import { BrandBillingController } from './brand-billing.controller';

// Global so campaign/other flows can inject BrandBillingService for entitlement
// gating without re-importing the module.
@Global()
@Module({
  providers: [BrandBillingService],
  controllers: [BrandBillingController],
  exports: [BrandBillingService],
})
export class BrandBillingModule {}
