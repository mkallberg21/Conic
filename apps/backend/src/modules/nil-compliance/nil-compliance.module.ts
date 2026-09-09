import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NilComplianceService } from './nil-compliance.service';
import { NilComplianceController } from './nil-compliance.controller';
import { DealLinkService } from './deal-link.service';
import { DealLinkController } from './deal-link.controller';
import { DealLinkPublicController } from './deal-link.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { GuardianModule } from '../guardian/guardian.module';

@Module({
  imports: [PrismaModule, HttpModule, AuditModule, GuardianModule],
  providers: [NilComplianceService, DealLinkService],
  controllers: [NilComplianceController, DealLinkController, DealLinkPublicController],
  exports: [NilComplianceService, DealLinkService],
})
export class NilComplianceModule {}
