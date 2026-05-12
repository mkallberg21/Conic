import { Module } from '@nestjs/common';
import { ContractTemplatesService } from './contract-templates.service';
import { ContractTemplatesController } from './contract-templates.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [ContractTemplatesService],
  controllers: [ContractTemplatesController],
  exports: [ContractTemplatesService],
})
export class ContractTemplatesModule {}
