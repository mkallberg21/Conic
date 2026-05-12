import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AiService } from '../ai/ai.service';
import { TaskRouter } from './router/task-router';
import { ExecutionStep } from './router/task-router';
import { ConflictResolver } from './conflict/conflict-resolver';
import { OutputNormalizer } from './normalizer/output-normalizer';
import { DecisionLogger, DecisionRecord } from './audit/decision-logger';
import { ContextStore } from './context/context.store';
import {
  OrchestratorRequest,
  OrchestratorResponse,
  ModuleResult,
  TaskType,
  ModuleId,
} from './types/orchestrator.types';

/**
 * UnifiedAIOrchestrator — the central brain of the entire AI layer.
 *
 * Responsibilities
 * ────────────────
 * • Own all AI decision-making (no module may act autonomously).
 * • Route tasks to the correct AI modules via TaskRouter.
 * • Execute stages (sequential) and steps within a stage (parallel).
 * • Resolve conflicting outputs via ConflictResolver.
 * • Normalise every response to the unified output contract.
 * • Maintain per-session short-term context via ContextStore.
 * • Audit every decision via DecisionLogger.
 *
 * Hierarchy
 * ─────────
 *   Level 1 — UnifiedAIOrchestrator  (this service)   absolute authority
 *   Level 2 — AI Modules (AiService methods)           no autonomy
 *   Level 3 — Model Runtimes (Python microservices)    pure inference
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger('UnifiedAIOrchestrator');

  constructor(
    private readonly aiService: AiService,
    private readonly taskRouter: TaskRouter,
    private readonly conflictResolver: ConflictResolver,
    private readonly outputNormalizer: OutputNormalizer,
    private readonly decisionLogger: DecisionLogger,
    private readonly contextStore: ContextStore,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Execute any AI task.  This is the single entry-point for the entire
   * AI layer.  All other AI calls within the platform should route through
   * this method.
   */
  async execute(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const taskId = uuidv4();
    const startMs = Date.now();
    const sessionId = request.context?.sessionId ?? taskId;

    this.logger.log(
      `[${taskId}] START ${request.taskType} | session=${sessionId} | user=${request.context?.userId ?? 'anon'}`,
    );

    // 1. Resolve execution plan
    const plan = this.taskRouter.resolve(request.taskType);

    // 2. Enrich payload with prior session context (cross-call memory)
    const sessionCtx = this.contextStore.getSession(sessionId);
    const enrichedPayload: Record<string, unknown> = {
      ...sessionCtx,
      ...request.payload,
    };

    // 3. Execute all stages (sequential), steps within each stage (parallel)
    const allModuleResults: ModuleResult[] = [];
    for (const stage of plan.steps) {
      const stageResults = await this.executeStage(stage, enrichedPayload, taskId);
      allModuleResults.push(...stageResults);
    }

    // 4. Merge / resolve conflicts according to the plan's merge strategy
    let merged: Record<string, unknown>;
    let conflicts: OrchestratorResponse['conflicts'] = [];

    if (plan.mergeStrategy === 'combine') {
      // Each module contributes distinct fields — combine without conflict check
      merged = this.conflictResolver.combineResults(
        allModuleResults.filter(r => !r.error),
      );
    } else {
      // first | confidence-weighted — full conflict detection
      const resolved = this.conflictResolver.resolve(
        allModuleResults.filter(r => !r.error),
      );
      merged = resolved.merged;
      conflicts = resolved.conflicts;
    }

    // 5. Build reasoning trace
    const reasoning = this.buildReasoning(
      request.taskType,
      plan.description,
      allModuleResults,
      conflicts,
    );

    const executionMs = Date.now() - startMs;

    // 6. Normalise to unified output contract
    const response = this.outputNormalizer.normalize(
      taskId,
      request.taskType,
      allModuleResults,
      conflicts,
      merged,
      executionMs,
      reasoning,
    );

    // 7. Persist result into session context for future enrichment
    this.contextStore.set(sessionId, `last_${request.taskType}`, merged);
    this.contextStore.appendDecision(sessionId, {
      taskId,
      taskType: request.taskType,
      confidence: response.confidence,
      timestamp: response.timestamp,
    });

    // 8. Audit log
    this.decisionLogger.record(request, response);

    this.logger.log(
      `[${taskId}] END ${request.taskType} → ${response.status} ` +
        `| ${executionMs}ms | confidence=${response.confidence}`,
    );

    return response;
  }

  getAuditHistory(limit?: number): DecisionRecord[] {
    return this.decisionLogger.getHistory(limit);
  }

  getAuditStats() {
    return this.decisionLogger.getStats();
  }

  listTaskTypes(): TaskType[] {
    return this.taskRouter.listTaskTypes();
  }

  // ── Internal execution engine ───────────────────────────────────────────────

  private async executeStage(
    steps: ExecutionStep[],
    payload: Record<string, unknown>,
    taskId: string,
  ): Promise<ModuleResult[]> {
    // All steps in a stage run in parallel
    return Promise.all(steps.map(step => this.executeModule(step, payload, taskId)));
  }

  private async executeModule(
    step: ExecutionStep,
    payload: Record<string, unknown>,
    taskId: string,
  ): Promise<ModuleResult> {
    const start = Date.now();
    try {
      const result = await this.dispatch(step.method, payload);
      const durationMs = Date.now() - start;
      this.logger.debug(`[${taskId}] ${step.moduleId} OK (${durationMs}ms)`);
      return {
        moduleId: step.moduleId,
        result,
        confidence: this.extractConfidence(result, step.defaultConfidence),
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      this.logger.error(`[${taskId}] ${step.moduleId} FAILED (${durationMs}ms): ${err}`);
      if (step.required) throw err; // propagate — task cannot complete
      return {
        moduleId: step.moduleId,
        result: null,
        confidence: 0,
        durationMs,
        error: String(err),
      };
    }
  }

  /**
   * Dispatch table — maps execution step method names to AiService calls.
   * This is the ONLY place where Level 1 → Level 2 calls happen, keeping
   * all routing logic in the orchestrator layer.
   */
  private async dispatch(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    switch (method) {
      case 'runContractGenerate':
      case 'runContractRisk':
        return this.aiService.generateContractContent(
          payload as unknown as Parameters<AiService['generateContractContent']>[0],
        );

      case 'runDeliverableVerify':
        return this.aiService.verifyDeliverable(
          payload['deliverableId'] as string,
          payload as unknown as Parameters<AiService['verifyDeliverable']>[1],
        );

      case 'runPricingRecommend':
        return this.aiService.getPricingRecommendation(
          payload as unknown as Parameters<AiService['getPricingRecommendation']>[0],
        );

      case 'runCreatorGraph':
        return this.aiService.predictCreatorPerformance(payload['creatorId'] as string);

      case 'runPerformancePredict':
        return this.aiService.predictPerformanceFull(
          payload as unknown as Parameters<AiService['predictPerformanceFull']>[0],
        );

      case 'runCampaignTimeline':
        return this.aiService.generateCampaignTimeline(
          payload as unknown as Parameters<AiService['generateCampaignTimeline']>[0],
        );

      case 'runCampaignDebrief':
        return this.aiService.generateCampaignDebrief(
          payload as unknown as Parameters<AiService['generateCampaignDebrief']>[0],
        );

      default:
        throw new Error(`[Orchestrator] Unknown dispatch method: ${method}`);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private extractConfidence(result: unknown, defaultConfidence: number): number {
    if (!result || typeof result !== 'object') return defaultConfidence;
    const r = result as Record<string, unknown>;

    // Fractional (0–1)
    if (typeof r['confidence'] === 'number' && r['confidence'] <= 1)
      return r['confidence'];

    // Percentage (0–100) → normalise
    if (typeof r['confidence_score'] === 'number')
      return r['confidence_score'] > 1
        ? r['confidence_score'] / 100
        : r['confidence_score'];

    // Inverse of risk (riskScore 0–100)
    if (typeof r['riskScore'] === 'number')
      return 1 - r['riskScore'] / 100;

    return defaultConfidence;
  }

  private buildReasoning(
    taskType: TaskType,
    planDescription: string,
    results: ModuleResult[],
    conflicts: OrchestratorResponse['conflicts'],
  ): string {
    const ok = results.filter(r => !r.error).map(r => r.moduleId);
    const failed = results.filter(r => r.error).map(r => r.moduleId);

    let s = `Task=${taskType}. ${planDescription}. Modules=[${ok.join(', ')}].`;
    if (failed.length > 0)
      s += ` Non-critical failures=[${failed.join(', ')}].`;
    if (conflicts.length > 0)
      s += ` ${conflicts.length} conflict(s) auto-resolved:`;
    for (const c of conflicts)
      s += ` [${c.field}: ${c.moduleA}≠${c.moduleB} → ${c.resolution}]`;

    return s;
  }

  // ── Maintenance ─────────────────────────────────────────────────────────────

  /** Purge expired session context entries every 15 minutes. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  handleContextPurge(): void {
    this.contextStore.purgeExpired();
  }
}
