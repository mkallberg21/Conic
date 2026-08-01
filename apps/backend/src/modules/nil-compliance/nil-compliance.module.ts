import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NilComplianceService } from './nil-compliance.service';
import { NilComplianceController } from './nil-compliance.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { GuardianModule } from '../guardian/guardian.module';

@Module({
  imports: [PrismaModule, HttpModule, AuditModule, GuardianModule],
  providers: [NilComplianceService],
  controllers: [NilComplianceController],
  exports: [NilComplianceService],
})
export class NilComplianceModule {}
