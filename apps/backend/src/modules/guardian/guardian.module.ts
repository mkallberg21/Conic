import { Module } from '@nestjs/common';
import { GuardianService } from './guardian.service';
import { GuardianController } from './guardian.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [PrismaModule, AuditModule, EmailModule],
  providers: [GuardianService],
  controllers: [GuardianController],
  exports: [GuardianService],
})
export class GuardianModule {}
