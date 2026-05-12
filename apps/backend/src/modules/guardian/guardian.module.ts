import { Module } from '@nestjs/common';
import { GuardianService } from './guardian.service';
import { GuardianController } from './guardian.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [GuardianService],
  controllers: [GuardianController],
  exports: [GuardianService],
})
export class GuardianModule {}
