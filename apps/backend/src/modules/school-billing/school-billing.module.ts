import { Module } from '@nestjs/common';
import { SchoolBillingService } from './school-billing.service';
import { SchoolBillingController } from './school-billing.controller';

@Module({
  providers: [SchoolBillingService],
  controllers: [SchoolBillingController],
  exports: [SchoolBillingService],
})
export class SchoolBillingModule {}
