import { Global, Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { BillingProvider } from './billing.provider';

// Global so feature gates (e.g. "which brands viewed you") can inject
// SubscriptionService without re-importing the module.
@Global()
@Module({
  providers: [SubscriptionService, BillingProvider],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
