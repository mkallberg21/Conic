import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DeliverablesModule } from './modules/deliverables/deliverables.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EventBusModule } from './events/event-bus.module';
import { AuditModule } from './common/audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { FeatureStoreModule } from './modules/feature-store/feature-store.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    // Rate limiting — tightened for auth endpoints
    ThrottlerModule.forRoot([
      { name: 'global-short', ttl: 1000, limit: 30 },
      { name: 'global-long', ttl: 60000, limit: 300 },
    ]),

    // Events & scheduling
    EventEmitterModule.forRoot({ wildcard: true }),
    ScheduleModule.forRoot(),

    // Core infrastructure (global)
    PrismaModule,
    CacheModule,
    EventBusModule,
    AuditModule,

    // Feature modules
    AuthModule,
    UsersModule,
    BrandsModule,
    CreatorsModule,
    ContractsModule,
    DeliverablesModule,
    PaymentsModule,
    CampaignsModule,
    AnalyticsModule,
    AiModule,
    NotificationsModule,
    QueueModule,
    WebhooksModule,
    HealthModule,
    FeatureStoreModule,
  ],
})
export class AppModule {}
