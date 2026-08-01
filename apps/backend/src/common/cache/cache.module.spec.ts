import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CacheModule, REDIS_CLIENT } from './cache.module';
import { CacheService } from './cache.service';

/**
 * Regression test for a circular import (cache.module <-> cache.service) that left
 * the @Inject(REDIS_CLIENT) token undefined at decoration time, so Nest could not
 * resolve CacheService and the app failed to boot ("can't resolve dependencies of
 * the CacheService (?)"). The ioredis client uses lazyConnect, so this resolves the
 * DI graph without a running Redis.
 */
describe('CacheModule (DI resolution)', () => {
  let moduleRef: TestingModule;

  afterEach(async () => {
    // lazyConnect client never opened a socket; disconnect cleanly so Jest exits
    try {
      moduleRef?.get(REDIS_CLIENT)?.disconnect();
    } catch {
      /* noop */
    }
    await moduleRef?.close();
  });

  it('resolves CacheService and the REDIS_CLIENT token', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), CacheModule],
    }).compile();

    expect(moduleRef.get(CacheService)).toBeInstanceOf(CacheService);
    expect(moduleRef.get(REDIS_CLIENT)).toBeDefined();
  });
});
