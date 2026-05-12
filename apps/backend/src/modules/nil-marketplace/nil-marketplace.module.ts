import { Module } from '@nestjs/common';
import { NilMarketplaceService } from './nil-marketplace.service';
import { NilMarketplaceController } from './nil-marketplace.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [NilMarketplaceService],
  controllers: [NilMarketplaceController],
  exports: [NilMarketplaceService],
})
export class NilMarketplaceModule {}
