import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './cache.constants';
import Redis from 'ioredis';

// Re-exported for existing importers; the token lives in cache.constants to avoid
// a cache.module <-> cache.service circular import.
export { REDIS_CLIENT } from './cache.constants';

const redisLogger = new Logger('Redis');

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

        client.on('connect', () => {
          redisLogger.log('Connected to Redis');
        });

        client.on('ready', () => {
          redisLogger.log('Redis client ready');
        });

        client.on('error', (err: Error) => {
          if (process.env.NODE_ENV !== 'test') {
            // Structured log — captured by any NestJS log transporter (e.g. Winston/Pino)
            redisLogger.error('Redis connection error', err.stack);
          }
        });

        client.on('close', () => {
          redisLogger.warn('Redis connection closed — will retry');
        });

        client.on('reconnecting', (delay: number) => {
          redisLogger.warn(`Redis reconnecting in ${delay}ms`);
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
