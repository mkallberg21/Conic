import { Test, TestingModule } from '@nestjs/testing';
import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

/**
 * Boot smoke test — the one thing the unit suites cannot prove: that the ENTIRE
 * AppModule dependency graph wires up and the app actually starts against real
 * Postgres + Redis, then serves HTTP.
 *
 * Requires a running Postgres and Redis (Prisma, the Throttler, and BullMQ all
 * connect at startup). It is intended for CI's `test-backend` job, which provides
 * both services and runs `prisma migrate deploy` first. It will not boot in an
 * environment without that infrastructure.
 *
 * Routing mirrors main.ts: global prefix `api` + URI versioning (default `1`),
 * so the health routes live under `/api/v1/health`.
 */
describe('App boot (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  const inject = (url: string) => app.getHttpAdapter().getInstance().inject({ method: 'GET', url });

  it('boots and serves the liveness probe', async () => {
    const res = await inject('/api/v1/health/live');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('status', 'ok');
  });

  it('serves the readiness probe', async () => {
    const res = await inject('/api/v1/health/ready');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('status', 'ok');
  });

  it('exposes the full health check (database + redis indicators)', async () => {
    const res = await inject('/api/v1/health');
    // 200 when every indicator is up; 503 if one is down — either way the app
    // booted and Terminus produced a structured payload.
    expect([200, 503]).toContain(res.statusCode);
    expect(res.json()).toHaveProperty('status');
  });
});
