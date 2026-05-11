import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { PrismaModule } from './prisma/prisma.module';
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

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),

    // Events & scheduling
    EventEmitterModule.forRoot({ wildcard: true }),
    ScheduleModule.forRoot(),

    // Core
    PrismaModule,
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
  ],
})
export class AppModule {}
