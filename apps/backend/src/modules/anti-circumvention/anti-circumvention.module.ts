import { Global, Module } from '@nestjs/common';
import { AntiCircumventionService } from './anti-circumvention.service';
import { AntiCircumventionController } from './anti-circumvention.controller';
import { ContactScannerService } from './contact-scanner.service';

@Global()
@Module({
  controllers: [AntiCircumventionController],
  providers: [AntiCircumventionService, ContactScannerService],
  exports: [AntiCircumventionService, ContactScannerService],
})
export class AntiCircumventionModule {}
