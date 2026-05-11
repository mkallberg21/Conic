import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { EventBusService } from './event-bus.service';

export const QUEUE_NAMES = {
  CONTRACT: 'contracts',
  DELIVERABLE: 'deliverables',
  PAYMENT: 'payments',
  AI_TASKS: 'ai-tasks',
  NOTIFICATIONS: 'notifications',
  CAMPAIGN: 'campaigns',
} as const;

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CONNECTION',
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
      }),
      inject: [ConfigService],
    },
    EventBusService,
  ],
  exports: [EventBusService],
})
export class EventBusModule {}
