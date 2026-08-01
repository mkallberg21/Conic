import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { AiModule } from '../ai/ai.module';
import { GuardianModule } from '../guardian/guardian.module';

@Module({
  imports: [AiModule, GuardianModule],
  providers: [ContractsService],
  controllers: [ContractsController],
  exports: [ContractsService],
})
export class ContractsModule {}
