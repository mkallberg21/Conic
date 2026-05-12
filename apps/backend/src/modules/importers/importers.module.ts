import { Module } from '@nestjs/common';
import { ImportersService } from './importers.service';
import { ImportersController } from './importers.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [ImportersService],
  controllers: [ImportersController],
  exports: [ImportersService],
})
export class ImportersModule {}
