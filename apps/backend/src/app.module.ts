import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { SecurityModule } from './common/security/security.module';
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
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EventBusModule } from './events/event-bus.module';
import { AuditModule } from './common/audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { FeatureStoreModule } from './modules/feature-store/feature-store.module';
import { NilComplianceModule } from './modules/nil-compliance/nil-compliance.module';
import { UniversityModule } from './modules/university/university.module';
import { GuardianModule } from './modules/guardian/guardian.module';
import { AgentProfileModule } from './modules/agent-profile/agent-profile.module';
import { TaxDocumentsModule } from './modules/tax-documents/tax-documents.module';
import { ContractTemplatesModule } from './modules/contract-templates/contract-templates.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { NilMarketplaceModule } from './modules/nil-marketplace/nil-marketplace.module';
import { ImportersModule } from './modules/importers/importers.module';
import { DealRoomModule } from './modules/deal-room/deal-room.module';
import { CollectivePortalModule } from './modules/collective-portal/collective-portal.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { EarningsModule } from './modules/earnings/earnings.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ProfileModule } from './modules/profile/profile.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    // Rate limiting backed by Redis (survives restarts, shared across replicas)
    // Three tiers:
    //   burst    — 20 req/s  prevents hot-path floods
    //   standard — 120 req/min normal API usage
    //   auth     — 10 req/min on login/register (must be applied per-route via @Throttle)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'burst',    ttl: 1000,  limit: 20 },
          { name: 'standard', ttl: 60000, limit: 120 },
        ],
        storage: new ThrottlerStorageRedisService({
          host: config.get('redis.host', 'localhost'),
          port: config.get('redis.port', 6379),
          password: config.get<string | undefined>('redis.password'),
          keyPrefix: 'throttler:',
        }),
      }),
    }),

    // Events & scheduling
    EventEmitterModule.forRoot({ wildcard: true }),
    ScheduleModule.forRoot(),

    // Core infrastructure (global)
    PrismaModule,
    CacheModule,
    EncryptionModule,
    SecurityModule,
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
    OrchestratorModule,
    NotificationsModule,
    QueueModule,
    WebhooksModule,
    HealthModule,
    FeatureStoreModule,
    NilComplianceModule,
    UniversityModule,
    GuardianModule,
    AgentProfileModule,
    TaxDocumentsModule,
    ContractTemplatesModule,
    ApiKeysModule,
    NilMarketplaceModule,
    ImportersModule,
    DealRoomModule,
    CollectivePortalModule,
    MatchmakingModule,
    EarningsModule,
    CalendarModule,
    ProfileModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally — every route is rate-limited by default
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
