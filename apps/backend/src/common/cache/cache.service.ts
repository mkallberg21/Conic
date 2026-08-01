import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

// Default TTLs (seconds)
export const TTL = {
  VERY_SHORT: 30,       // 30 s  — hot/volatile data
  SHORT: 300,           // 5 min — creator discover lists
  MEDIUM: 1_800,        // 30 min — analytics aggregates
  LONG: 3_600,          // 1 h  — reference data, rate-cards
  VERY_LONG: 86_400,    // 24 h — static content
} as const;

export type CacheTTL = (typeof TTL)[keyof typeof TTL];

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Low-level ─────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null; // cache miss → caller falls through to DB
    }
  }

  async set<T>(key: string, value: T, ttl: number = TTL.SHORT): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Cache set failed for key=${key}: ${(err as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache del failed: ${(err as Error).message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length) await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache delPattern failed pattern=${pattern}: ${(err as Error).message}`);
    }
  }

  // ── Cache-aside helper ────────────────────────────────────────────────────

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = TTL.SHORT,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }

  // ── Typed key builders ────────────────────────────────────────────────────

  static keys = {
    creator: (id: string) => `creator:${id}`,
    creatorDiscover: (hash: string) => `creator:discover:${hash}`,
    creatorStats: (id: string) => `creator:stats:${id}`,
    brand: (id: string) => `brand:${id}`,
    campaign: (id: string) => `campaign:${id}`,
    campaignList: (brandId: string) => `campaign:list:${brandId}`,
    contract: (id: string) => `contract:${id}`,
    contractList: (brandId: string) => `contract:list:${brandId}`,
    analytics: (scope: string, id: string) => `analytics:${scope}:${id}`,
    notification: (userId: string) => `notif:${userId}`,
    rateCard: (creatorId: string) => `ratecard:${creatorId}`,
    graphNode: (creatorId: string) => `graph:node:${creatorId}`,
    prediction: (creatorId: string) => `prediction:${creatorId}`,
    modelRegistry: (type: string) => `model:champion:${type}`,
  } as const;

  // ── Counter helpers (for rate limiting / counters) ────────────────────────

  async increment(key: string, ttl: number = TTL.SHORT): Promise<number> {
    try {
      const val = await this.redis.incr(key);
      if (val === 1) await this.redis.expire(key, ttl);
      return val;
    } catch {
      return 0;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
