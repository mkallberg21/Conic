import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password'),
          tls: config.get<string>('app.env') === 'production' ? {} : undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          retryStrategy: (times) => Math.min(times * 200, 5000),
        });
        client.on('error', (err) => {
          // Non-fatal — cache miss degrades gracefully to DB
          if (process.env.NODE_ENV !== 'test') {
            console.error('[Redis] connection error', err.message);
          }
        });
        return client;
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
