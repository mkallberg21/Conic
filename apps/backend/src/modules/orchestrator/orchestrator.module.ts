import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';
import { TaskRouter } from './router/task-router';
import { ConflictResolver } from './conflict/conflict-resolver';
import { OutputNormalizer } from './normalizer/output-normalizer';
import { DecisionLogger } from './audit/decision-logger';
import { ContextStore } from './context/context.store';

@Module({
  imports: [AiModule],
  controllers: [OrchestratorController],
  providers: [
    OrchestratorService,
    TaskRouter,
    ConflictResolver,
    OutputNormalizer,
    DecisionLogger,
    ContextStore,
  ],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
