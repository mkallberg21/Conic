import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './prisma.health';
import { CacheService } from '../../common/cache/cache.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // 500 MB
      async () => {
        const ok = await this.cacheService.ping();
        return { redis: { status: ok ? 'up' : 'down' } };
      },
    ]);
  }

  @Get('ready')
  readiness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('live')
  liveness() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
