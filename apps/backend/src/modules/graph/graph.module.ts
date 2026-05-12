import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GraphService } from './graph.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [HttpModule, PrismaModule, CacheModule],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
