import { Module } from '@nestjs/common';
import { TaxDocumentsService } from './tax-documents.service';
import { TaxDocumentsController } from './tax-documents.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { EventBusModule } from '../../events/event-bus.module';

@Module({
  imports: [PrismaModule, AuditModule, EventBusModule],
  providers: [TaxDocumentsService],
  controllers: [TaxDocumentsController],
  exports: [TaxDocumentsService],
})
export class TaxDocumentsModule {}
