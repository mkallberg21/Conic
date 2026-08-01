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
  TaskType,} from './types/orchestrator.types';

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

    // 3a. Compound tasks: delegate to a named handler that owns its own fan-out
    if (plan.compoundHandler) {
      return this.executeCompound(
        plan.compoundHandler,
        taskId,
        sessionId,
        startMs,
        request,
        enrichedPayload,
      );
    }

    // 3b. Standard tasks: execute all stages (sequential), steps in parallel
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

  // ── Compound task dispatcher ────────────────────────────────────────────────

  private async executeCompound(
    handler: string,
    taskId: string,
    sessionId: string,
    startMs: number,
    request: OrchestratorRequest,
    payload: Record<string, unknown>,
  ): Promise<OrchestratorResponse> {
    switch (handler) {
      case 'campaignIntelligence':
        return this.executeCampaignIntelligence(taskId, sessionId, startMs, request, payload);
      case 'creatorRoster':
        return this.executeCreatorRoster(taskId, sessionId, startMs, request, payload);
      case 'contractIntelligence':
        return this.executeContractIntelligence(taskId, sessionId, startMs, request, payload);
      case 'deliverableIntelligence':
        return this.executeDeliverableIntelligence(taskId, sessionId, startMs, request, payload);
      default:
        throw new Error(`[Orchestrator] Unknown compound handler: ${handler}`);
    }
  }

  /**
   * CONTRACT_INTELLIGENCE — self-correcting contract generation loop.
   *
   * Stage 1 (parallel):
   *   • contract-ai /generate   → draft contract text + initial risk flags
   *   • contract-ai /risk       → independent risk analysis (LLM-powered)
   *
   * Orchestrator merges the two risk assessments (union of flags, max score).
   *
   * Revision loop (max MAX_REVISION_ROUNDS):
   *   While riskScore > riskThreshold AND remainingFlags.length > 0:
   *     • contract-ai /revise   → patched contract + updated risk score
   *     • if improved           → continue; else break (no progress)
   *
   * Returns: final contract, full revision history, all risk rounds.
   *
   * Expected payload:
   * {
   *   campaignType, platforms[], usageRights, exclusivity, exclusivityDays?,
   *   totalValue, brandName?, creatorName?, deliverableTypes?,
   *   riskThreshold?    // 0-100, default 20
   *   maxRevisions?     // 1-5,   default 3
   * }
   */
  private async executeContractIntelligence(
    taskId: string,
    sessionId: string,
    startMs: number,
    request: OrchestratorRequest,
    payload: Record<string, unknown>,
  ): Promise<OrchestratorResponse> {
    const MAX_REVISION_ROUNDS = Math.min(Number(payload['maxRevisions'] ?? 3), 5);
    const RISK_THRESHOLD = Math.min(
      Math.max(Number(payload['riskThreshold'] ?? 20), 0),
      100,
    );

    this.logger.log(
      `[${taskId}] CONTRACT_INTELLIGENCE start | threshold=${RISK_THRESHOLD} | maxRounds=${MAX_REVISION_ROUNDS}`,
    );

    // ── Stage 1: generate + risk-score in parallel ────────────────────────────
    const [generateResult, riskResult] = await Promise.all([
      this.executeModule(
        { moduleId: 'contract-ai', method: 'runContractGenerate', required: true, defaultConfidence: 0.85 },
        payload,
        taskId,
      ),
      this.executeModule(
        { moduleId: 'contract-ai', method: 'runContractRisk', required: false, defaultConfidence: 0.80 },
        payload,
        taskId,
      ),
    ]);

    const generateData = (generateResult.result ?? {}) as Record<string, unknown>;
    const riskData    = (riskResult.result ?? {}) as Record<string, unknown>;

    // Merge risk flags (union) and take the highest score
    const initialFlags = Array.from(
      new Set([
        ...((generateData['risk_flags'] as string[] | undefined) ?? []),
        ...((riskData['risk_flags'] as string[] | undefined) ?? []),
      ]),
    );
    const initialScore = Math.max(
      Number(generateData['risk_score'] ?? 100),
      Number(riskData['risk_score'] ?? 0),
    );

    this.logger.log(
      `[${taskId}] Initial: score=${initialScore} flags=[${initialFlags.join(',')}]`,
    );

    // ── Track revision history ────────────────────────────────────────────────
    const revisionHistory: Array<{
      round: number;
      flagsIn: string[];
      scoreIn: number;
      flagsOut: string[];
      scoreOut: number;
      improved: boolean;
      notes: string[];
    }> = [];
    const allModuleResults: ModuleResult[] = [generateResult, riskResult];

    let currentContent = (generateData['content'] as string | undefined) ?? '';
    let currentFlags   = initialFlags;
    let currentScore   = initialScore;

    // ── Revision loop ─────────────────────────────────────────────────────────
    for (let round = 1; round <= MAX_REVISION_ROUNDS; round++) {
      if (currentScore <= RISK_THRESHOLD || currentFlags.length === 0) {
        this.logger.log(`[${taskId}] Risk threshold met at round ${round - 1}. Stopping.`);
        break;
      }

      this.logger.log(
        `[${taskId}] Revision round ${round}/${MAX_REVISION_ROUNDS} | ` +
          `score=${currentScore} flags=[${currentFlags.join(',')}]`,
      );

      const revisePayload = {
        contractText: currentContent,
        riskFlags: currentFlags,
        campaignType: payload['campaignType'] as string | undefined,
        platforms: payload['platforms'] as string[] | undefined,
        totalValue: payload['totalValue'] as number | undefined,
        exclusivity: payload['exclusivity'] as boolean | undefined,
        exclusivityDays: payload['exclusivityDays'] as number | undefined,
      };

      const reviseResult = await this.executeModule(
        { moduleId: 'contract-ai', method: 'runContractRevise', required: false, defaultConfidence: 0.82 },
        revisePayload as unknown as Record<string, unknown>,
        taskId,
      );
      allModuleResults.push(reviseResult);

      if (reviseResult.error) {
        this.logger.warn(`[${taskId}] Revision round ${round} failed: ${reviseResult.error}`);
        break;
      }

      const reviseData = (reviseResult.result ?? {}) as Record<string, unknown>;
      const improved   = reviseData['improved'] as boolean | undefined;
      const newContent = reviseData['revised_content'] as string | undefined;
      const newFlags   = (reviseData['risk_flags_remaining'] as string[] | undefined) ?? currentFlags;
      const newScore   = Number(reviseData['risk_score'] ?? currentScore);
      const notes      = (reviseData['revision_notes'] as string[] | undefined) ?? [];

      revisionHistory.push({
        round,
        flagsIn: currentFlags,
        scoreIn: currentScore,
        flagsOut: newFlags,
        scoreOut: newScore,
        improved: improved ?? newScore < currentScore,
        notes,
      });

      if (!improved && newScore >= currentScore) {
        this.logger.warn(`[${taskId}] Round ${round}: no improvement (${currentScore}→${newScore}). Stopping.`);
        break;
      }

      currentContent = newContent ?? currentContent;
      currentFlags   = newFlags;
      currentScore   = newScore;
    }

    // ── Build merged result ───────────────────────────────────────────────────
    const merged: Record<string, unknown> = {
      content: currentContent,
      finalRiskScore: currentScore,
      finalRiskFlags: currentFlags,
      initialRiskScore: initialScore,
      initialRiskFlags: initialFlags,
      flagsResolved: initialFlags.filter(f => !currentFlags.includes(f)),
      revisionRounds: revisionHistory.length,
      revisionHistory,
      thresholdMet: currentScore <= RISK_THRESHOLD,
      riskThresholdUsed: RISK_THRESHOLD,
      // Pass through additional fields from original generate result
      clauses: generateData['clauses'],
      suggestions: generateData['suggestions'],
      wordCount: currentContent.split(' ').length,
    };

    const executionMs = Date.now() - startMs;
    const reasoning =
      `Task=CONTRACT_INTELLIGENCE. ` +
      `Stage 1: generate + risk in parallel. ` +
      `Initial risk=${initialScore} (${initialFlags.length} flags). ` +
      `Revision rounds=${revisionHistory.length}/${MAX_REVISION_ROUNDS}. ` +
      `Final risk=${currentScore} (${currentFlags.length} flags remaining). ` +
      `Threshold=${RISK_THRESHOLD} ${currentScore <= RISK_THRESHOLD ? 'MET ✓' : 'NOT MET — max rounds reached'}.`;

    const response = this.outputNormalizer.normalize(
      taskId,
      'CONTRACT_INTELLIGENCE',
      allModuleResults.filter(r => !r.error),
      [],
      merged,
      executionMs,
      reasoning,
    );

    this.contextStore.set(sessionId, 'last_CONTRACT_INTELLIGENCE', merged);
    this.contextStore.appendDecision(sessionId, {
      taskId,
      taskType: 'CONTRACT_INTELLIGENCE',
      confidence: response.confidence,
      timestamp: response.timestamp,
    });
    this.decisionLogger.record(request, response);

    this.logger.log(
      `[${taskId}] END CONTRACT_INTELLIGENCE → ${response.status} ` +
        `| ${executionMs}ms | rounds=${revisionHistory.length} | finalScore=${currentScore}`,
    );

    return response;
  }

  /**
   * DELIVERABLE_INTELLIGENCE — multi-stage deliverable assessment.
   *
   * Stage 1 (parallel):
   *   • deliverable-verification-ai /verify  → compliance + brand-safety check
   *   • performance-prediction-ai /predict   → reach / engagement forecast
   *
   * Stage 2 (conditional, sequential — based on Stage 1 outcome):
   *   • FAILED / FLAGGED → deliverable-verification-ai /feedback
   *     ↳ Structured remediation plan: severity-ranked fix instructions, estimated
   *       revision time, priority actions.
   *   • PASSED → pricing-engine-ai /recommend
   *     ↳ Market-rate valuation for the deliverable (payment reference price).
   *
   * Returns: verificationStatus, performanceForecast, remediationPlan | valuationReport,
   *          complianceScore (0–100), and a single actionable summary.
   *
   * Expected payload:
   * {
   *   deliverableId?,          // optional — persisted to DB when present
   *   proofUrl,                // public content URL
   *   platform,                // instagram | tiktok | youtube | twitter | linkedin
   *   contentType,             // post | reel | story | video | image
   *   requiredHashtags?,
   *   requiredMentions?,
   *   caption?,
   *   // creator context for performance prediction
   *   followers,
   *   engagementRate,
   *   niche?,
   *   avgViews?,
   *   audienceScore?,
   *   fraudScore?,
   *   // performance context
   *   creatorName?,
   *   campaignName?,
   * }
   */
  private async executeDeliverableIntelligence(
    taskId: string,
    sessionId: string,
    startMs: number,
    request: OrchestratorRequest,
    payload: Record<string, unknown>,
  ): Promise<OrchestratorResponse> {
    this.logger.log(`[${taskId}] DELIVERABLE_INTELLIGENCE start`);

    // ── Stage 1: verify + predict in parallel ─────────────────────────────────
    const [verifyResult, predictResult] = await Promise.all([
      this.executeModule(
        {
          moduleId: 'deliverable-verification-ai',
          method: 'runDeliverableVerify',
          required: true,
          defaultConfidence: 0.90,
        },
        payload,
        taskId,
      ),
      this.executeModule(
        {
          moduleId: 'performance-prediction-ai',
          method: 'runPerformancePredict',
          required: false,
          defaultConfidence: 0.83,
        },
        payload,
        taskId,
      ),
    ]);

    const verifyData  = (verifyResult.result ?? {}) as Record<string, unknown>;
    const predictData = (predictResult.result ?? {}) as Record<string, unknown>;

    const verificationStatus = (verifyData['status'] as string | undefined) ?? 'FAILED';
    const verificationScore  = Number(verifyData['verificationScore'] ?? verifyData['verification_score'] ?? 0);
    const verificationFlags  = (verifyData['flags'] as string[] | undefined) ?? [];
    const verificationChecks = (verifyData['checks'] as unknown[] | undefined) ?? [];

    this.logger.log(
      `[${taskId}] Stage 1 complete | status=${verificationStatus} ` +
        `score=${verificationScore} flags=[${verificationFlags.join(',')}]`,
    );

    const allModuleResults: ModuleResult[] = [verifyResult, predictResult];

    // ── Stage 2: conditional branch ───────────────────────────────────────────
    let remediationPlan: Record<string, unknown> | null = null;
    let valuationReport: Record<string, unknown> | null = null;

    if (verificationStatus !== 'PASSED' && verificationFlags.length > 0) {
      // FAILED or FLAGGED → generate remediation feedback
      this.logger.log(`[${taskId}] Stage 2: deliverable failed — generating remediation plan`);

      const feedbackResult = await this.executeModule(
        {
          moduleId: 'deliverable-verification-ai',
          method: 'runDeliverableFeedback',
          required: false,
          defaultConfidence: 0.88,
        },
        {
          verificationFlags,
          platform: payload['platform'],
          contentType: payload['contentType'],
          proofUrl: payload['proofUrl'],
          creatorName: payload['creatorName'],
          campaignName: payload['campaignName'],
        },
        taskId,
      );
      allModuleResults.push(feedbackResult);
      remediationPlan = (feedbackResult.result ?? {}) as Record<string, unknown>;
    } else if (verificationStatus === 'PASSED') {
      // PASSED → value the deliverable for payment
      this.logger.log(`[${taskId}] Stage 2: deliverable passed — fetching pricing valuation`);

      const pricingResult = await this.executeModule(
        {
          moduleId: 'pricing-engine-ai',
          method: 'runPricingRecommend',
          required: false,
          defaultConfidence: 0.82,
        },
        {
          platform: payload['platform'],
          contentType: payload['contentType'],
          niche: payload['niche'] ?? [],
          followersCount: payload['followers'],
          engagementRate: payload['engagementRate'],
        },
        taskId,
      );
      allModuleResults.push(pricingResult);
      valuationReport = (pricingResult.result ?? {}) as Record<string, unknown>;
    }

    // ── Compute unified compliance score ─────────────────────────────────────
    // verificationScore (0–100) weighted 70 %; fraud inverse 30 %
    const fraudScore    = Number(predictData['fraud_likelihood'] ?? predictData['fraudScore'] ?? 0);
    const complianceScore = Math.round(
      verificationScore * 0.7 + (1 - Math.min(fraudScore, 1)) * 100 * 0.3,
    );

    // ── Build merged result ───────────────────────────────────────────────────
    const merged: Record<string, unknown> = {
      verificationStatus,
      verificationScore,
      verificationFlags,
      verificationChecks,
      complianceScore,
      remediationRequired: verificationStatus !== 'PASSED',
      remediationPlan,
      valuationReport,
      performanceForecast: {
        tier:                 predictData['tier'],
        reachEstimate:        predictData['reach_estimate'],
        engagementPredicted:  predictData['engagement_rate_predicted'],
        roiEstimate:          predictData['roi_estimate'],
        fraudLikelihood:      fraudScore,
        confidenceScore:      predictData['confidence_score'],
        percentileRank:       predictData['percentile_rank'],
      },
      summary:
        verificationStatus === 'PASSED'
          ? `Deliverable passed all compliance checks (score ${verificationScore}/100). ` +
            `Audience fraud likelihood: ${(fraudScore * 100).toFixed(1)}%. ` +
            (valuationReport
              ? `Estimated market value: $${((Number(valuationReport['recommendedRate'] ?? valuationReport['recommended_rate'] ?? 0)) / 100).toFixed(2)}.`
              : '')
          : `Deliverable requires revision — ${verificationFlags.length} flag(s) detected ` +
            `(score ${verificationScore}/100). ` +
            (remediationPlan
              ? `Remediation plan includes ${Number(remediationPlan['totalFlags'] ?? 0)} fix(es); ` +
                `estimated revision time ~${Number(remediationPlan['estimatedRevisionMinutes'] ?? 10)} minutes.`
              : ''),
    };

    const executionMs = Date.now() - startMs;
    const reasoning =
      `Task=DELIVERABLE_INTELLIGENCE. ` +
      `Stage 1: verify (${verificationStatus}, score=${verificationScore}) + ` +
      `performance predict (fraudLikelihood=${(fraudScore * 100).toFixed(1)}%) in parallel. ` +
      `Stage 2: ${
        verificationStatus !== 'PASSED'
          ? `feedback remediation (${(remediationPlan?.['totalFlags'] ?? 0)} fix items)`
          : `pricing valuation ($${((Number(valuationReport?.['recommendedRate'] ?? valuationReport?.['recommended_rate'] ?? 0)) / 100).toFixed(2)} recommended)`
      }. ComplianceScore=${complianceScore}/100.`;

    const response = this.outputNormalizer.normalize(
      taskId,
      'DELIVERABLE_INTELLIGENCE',
      allModuleResults.filter(r => !r.error),
      [],
      merged,
      executionMs,
      reasoning,
    );

    this.contextStore.set(sessionId, 'last_DELIVERABLE_INTELLIGENCE', merged);
    this.contextStore.appendDecision(sessionId, {
      taskId,
      taskType: 'DELIVERABLE_INTELLIGENCE',
      confidence: response.confidence,
      timestamp: response.timestamp,
    });
    this.decisionLogger.record(request, response);

    this.logger.log(
      `[${taskId}] END DELIVERABLE_INTELLIGENCE → ${response.status} ` +
        `| ${executionMs}ms | compliance=${complianceScore} | status=${verificationStatus}`,
    );

    return response;
  }

  /**
   * CAMPAIGN_INTELLIGENCE — compound fan-out execution.
   *
   * Stage 1 (all in parallel):
   *   • Campaign timeline  (campaign-agent-ai)
   *   • For each creator:  graph-ai + performance-ai + pricing-engine-ai
   *     ↳ Each creator's dual-model prediction is conflict-resolved independently.
   *
   * Expected payload shape:
   * {
   *   campaign: { objective?, platforms[], budget?, startDate?, endDate?, title?, creatorCount? }
   *   creators: Array<{
   *     creatorId, followers, engagementRate, niche?, platform?,
   *     avgViews?, audienceScore?, fraudScore?
   *   }>
   * }
   *
   * Max 20 creators per call to prevent runaway parallelism.
   */
  private async executeCampaignIntelligence(
    taskId: string,
    sessionId: string,
    startMs: number,
    request: OrchestratorRequest,
    payload: Record<string, unknown>,
  ): Promise<OrchestratorResponse> {
    const campaign = (payload['campaign'] ?? payload) as Record<string, unknown>;
    const rawCreators = Array.isArray(payload['creators']) ? payload['creators'] : [];
    const MAX_CREATORS = 20;
    const creators = rawCreators.slice(0, MAX_CREATORS) as Array<Record<string, unknown>>;

    this.logger.log(
      `[${taskId}] CAMPAIGN_INTELLIGENCE fan-out: ${creators.length} creator(s) in parallel`,
    );

    // ── Stage 1: timeline + all creator intelligence in parallel ─────────────
    const [timelineResult, ...creatorResults] = await Promise.all([
      // Timeline
      this.executeModule(
        {
          moduleId: 'campaign-agent-ai',
          method: 'runCampaignTimeline',
          required: true,
          defaultConfidence: 0.87,
        },
        campaign,
        taskId,
      ),
      // Per-creator intelligence: graph + performance + pricing in parallel
      ...creators.map(creator =>
        this.executeCreatorIntelligence(creator, taskId),
      ),
    ]);

    // ── Stage 2: resolve creator profiles ────────────────────────────────────
    const creatorProfiles = creatorResults.map((cr, idx) => {
      const creatorId = (creators[idx]['creatorId'] ?? `creator-${idx}`) as string;
      const { merged: intelligence, conflicts: creatorConflicts } = cr;
      return {
        creatorId,
        intelligence: this.outputNormalizer.applyOutputContract(intelligence),
        conflicts: creatorConflicts,
        confidence:
          creatorConflicts.length === 0
            ? 0.85
            : Math.max(0.6, 0.85 - creatorConflicts.length * 0.05),
      };
    });

    // ── Stage 3: aggregate launch plan metrics ────────────────────────────────
    const launchPlan = this.aggregateLaunchPlan(campaign, creatorProfiles);

    const merged: Record<string, unknown> = {
      timeline: timelineResult.result ?? {},
      creatorProfiles,
      launchPlan,
    };

    // ── Flatten module results for response metadata ──────────────────────────
    const allModuleResults: ModuleResult[] = [timelineResult];
    for (const cr of creatorResults) {
      allModuleResults.push(...cr.moduleResults);
    }
    const allConflicts = creatorResults.flatMap(cr => cr.conflicts);

    const executionMs = Date.now() - startMs;
    const reasoning =
      `Task=CAMPAIGN_INTELLIGENCE. Timeline via campaign-agent-ai. ` +
      `${creators.length} creator(s) analysed via creator-graph-ai + ` +
      `performance-prediction-ai + pricing-engine-ai (parallel fan-out). ` +
      `${allConflicts.length} conflict(s) resolved. ` +
      `EstimatedReach=${(launchPlan['totalEstimatedReach'] as number | undefined ?? 0).toLocaleString()}. ` +
      `BudgetRequired=$${((launchPlan['totalBudgetRequiredCents'] as number | undefined ?? 0) / 100).toFixed(0)}.`;

    const response = this.outputNormalizer.normalize(
      taskId,
      'CAMPAIGN_INTELLIGENCE',
      allModuleResults.filter(r => !r.error),
      allConflicts,
      merged,
      executionMs,
      reasoning,
    );

    this.contextStore.set(sessionId, 'last_CAMPAIGN_INTELLIGENCE', merged);
    this.contextStore.appendDecision(sessionId, {
      taskId,
      taskType: 'CAMPAIGN_INTELLIGENCE',
      confidence: response.confidence,
      timestamp: response.timestamp,
    });
    this.decisionLogger.record(request, response);

    this.logger.log(
      `[${taskId}] END CAMPAIGN_INTELLIGENCE → ${response.status} ` +
        `| ${executionMs}ms | ${creators.length} creator(s) | confidence=${response.confidence}`,
    );

    return response;
  }

  /**
   * CREATOR_ROSTER — score every candidate creator and return an AI-ranked shortlist.
   *
   * Expected payload shape:
   * {
   *   brief: {
   *     objective?: string
   *     platforms?: string[]
   *     budget?: number          // total campaign budget in cents
   *     niche?: string[]         // target content niches
   *     minFollowers?: number
   *     maxFollowers?: number
   *     rosterSize?: number      // how many creators to return (default 10, max 50)
   *   }
   *   candidates: Array<{
   *     creatorId: string
   *     followers: number
   *     engagementRate: number
   *     niche?: string | string[]
   *     platform?: string
   *     avgViews?: number
   *     audienceScore?: number
   *     fraudScore?: number
   *     contentType?: string
   *   }>
   * }
   *
   * Max 100 candidates per call; max rosterSize 50.
   */
  private async executeCreatorRoster(
    taskId: string,
    sessionId: string,
    startMs: number,
    request: OrchestratorRequest,
    payload: Record<string, unknown>,
  ): Promise<OrchestratorResponse> {
    const brief = (payload['brief'] ?? {}) as Record<string, unknown>;
    const rawCandidates = Array.isArray(payload['candidates']) ? payload['candidates'] : [];
    const MAX_CANDIDATES = 100;
    const DEFAULT_ROSTER_SIZE = 10;
    const MAX_ROSTER_SIZE = 50;

    const candidates = rawCandidates.slice(0, MAX_CANDIDATES) as Array<Record<string, unknown>>;
    const rosterSize = Math.min(
      Number(brief['rosterSize'] ?? DEFAULT_ROSTER_SIZE) || DEFAULT_ROSTER_SIZE,
      MAX_ROSTER_SIZE,
    );

    this.logger.log(
      `[${taskId}] CREATOR_ROSTER fan-out: scoring ${candidates.length} candidate(s), roster=${rosterSize}`,
    );

    // ── Score all candidates in parallel ─────────────────────────────────────
    const scoredResults = await Promise.all(
      candidates.map(async (candidate, idx) => {
        const creatorId = (candidate['creatorId'] ?? `candidate-${idx}`) as string;
        const { merged: intelligence, conflicts, moduleResults } =
          await this.executeCreatorIntelligence(candidate, taskId);

        const score = this.computeRosterScore(intelligence, brief);
        return { creatorId, candidate, intelligence, conflicts, moduleResults, score };
      }),
    );

    // ── Rank by composite score descending ────────────────────────────────────
    const ranked = [...scoredResults].sort((a, b) => b.score.composite - a.score.composite);

    // ── Build shortlist ───────────────────────────────────────────────────────
    const shortlist = ranked.slice(0, rosterSize).map((entry, rank) => ({
      rank: rank + 1,
      creatorId: entry.creatorId,
      scores: entry.score,
      intelligence: this.outputNormalizer.applyOutputContract(entry.intelligence),
      conflicts: entry.conflicts,
      confidence: entry.conflicts.length === 0
        ? 0.85
        : Math.max(0.55, 0.85 - entry.conflicts.length * 0.05),
      recommendation: this.buildCreatorRecommendation(rank, entry.score, brief),
    }));

    // ── Budget summary ────────────────────────────────────────────────────────
    const budgetSummary = this.buildBudgetSummary(shortlist, brief);

    // ── Aggregate module results for response metadata ────────────────────────
    const allModuleResults = scoredResults.flatMap(r => r.moduleResults);
    const allConflicts = scoredResults.flatMap(r => r.conflicts);

    const merged: Record<string, unknown> = {
      shortlist,
      candidatesEvaluated: candidates.length,
      rosterSize: shortlist.length,
      budgetSummary,
      rankingCriteria: {
        primary: 'predicted_roi',
        secondary: 'audience_authenticity',
        tertiary: 'fraud_score_inverse',
        briefAlignmentBonus: !!brief['niche'],
      },
    };

    const executionMs = Date.now() - startMs;
    const topCreator = shortlist[0];
    const reasoning =
      `Task=CREATOR_ROSTER. Scored ${candidates.length} candidate(s) via ` +
      `creator-graph-ai + performance-prediction-ai + pricing-engine-ai (parallel). ` +
      `${allConflicts.length} conflict(s) resolved. ` +
      `Ranked by composite ROI score. ` +
      `Top pick=${topCreator?.creatorId ?? 'none'} (score=${topCreator?.scores.composite.toFixed(3) ?? 0}). ` +
      `Returning ${shortlist.length} of ${candidates.length}.`;

    const response = this.outputNormalizer.normalize(
      taskId,
      'CREATOR_ROSTER',
      allModuleResults.filter(r => !r.error),
      allConflicts,
      merged,
      executionMs,
      reasoning,
    );

    this.contextStore.set(sessionId, 'last_CREATOR_ROSTER', merged);
    this.contextStore.appendDecision(sessionId, {
      taskId,
      taskType: 'CREATOR_ROSTER',
      confidence: response.confidence,
      timestamp: response.timestamp,
    });
    this.decisionLogger.record(request, response);

    this.logger.log(
      `[${taskId}] END CREATOR_ROSTER → ${response.status} ` +
        `| ${executionMs}ms | ${candidates.length} candidates → ${shortlist.length} roster`,
    );

    return response;
  }

  /**
   * Composite roster score (0–1 range, higher = better fit).
   *
   * Components
   * ──────────
   *  40 % predicted ROI
   *  25 % audience authenticity (inverse of fraud likelihood)
   *  20 % engagement quality
   *  15 % brief alignment (niche match + budget fit)
   */
  private computeRosterScore(
    intelligence: Record<string, unknown>,
    brief: Record<string, unknown>,
  ): {
    composite: number;
    roi: number;
    authenticity: number;
    engagement: number;
    briefAlignment: number;
    tier: string;
    estimatedCostCents: number;
  } {
    // ROI (normalise to 0–1, cap at 10× ROI = 1.0)
    const rawRoi =
      (intelligence['predictedROI'] as number) ??
      (intelligence['roi_estimate'] as number) ??
      0;
    const roi = Math.min(rawRoi / 10, 1.0);

    // Authenticity (1 - fraud_likelihood)
    const fraudLikelihood =
      (intelligence['fraudLikelihood'] as number) ??
      (intelligence['fraud_score'] as number) ??
      0.1;
    const authenticity =
      (intelligence['audienceAuthenticity'] as number) ??
      (intelligence['audience_score'] as number) ??
      (1 - fraudLikelihood);

    // Engagement quality (normalise engagement rate: >10% = 1.0)
    const engRate =
      (intelligence['predictedEngagement'] as number) ??
      (intelligence['engagement_rate_predicted'] as number) ??
      0;
    const engagement = Math.min(engRate / 10, 1.0);

    // Brief alignment bonus
    const briefNiches = Array.isArray(brief['niche'])
      ? (brief['niche'] as string[])
      : brief['niche']
        ? [brief['niche'] as string]
        : [];
    const creatorNiches = Array.isArray(intelligence['niche'])
      ? (intelligence['niche'] as string[])
      : [];
    const nicheMatch =
      briefNiches.length === 0 || creatorNiches.length === 0
        ? 0.5
        : briefNiches.some(n =>
              creatorNiches.map(c => c.toLowerCase()).includes(n.toLowerCase()),
            )
          ? 1.0
          : 0.2;

    const pricing = intelligence['pricing'] as Record<string, unknown> | undefined;
    const estimatedCostCents = (pricing?.['recommended_rate'] as number) ?? 0;
    const campaignBudget = (brief['budget'] as number) ?? Infinity;
    const budgetFit = estimatedCostCents <= campaignBudget ? 1.0 : 0.3;
    const briefAlignment = nicheMatch * 0.6 + budgetFit * 0.4;

    const composite =
      roi * 0.4 +
      authenticity * 0.25 +
      engagement * 0.2 +
      briefAlignment * 0.15;

    const tier =
      (intelligence['tier'] as string) ??
      (pricing?.['tier'] as string) ??
      'micro';

    return {
      composite: Math.round(composite * 1000) / 1000,
      roi: Math.round(roi * 1000) / 1000,
      authenticity: Math.round(authenticity * 1000) / 1000,
      engagement: Math.round(engagement * 1000) / 1000,
      briefAlignment: Math.round(briefAlignment * 1000) / 1000,
      tier,
      estimatedCostCents,
    };
  }

  private buildCreatorRecommendation(
    rank: number,
    score: { composite: number; roi: number; authenticity: number; briefAlignment: number },
    brief: Record<string, unknown>,
  ): string {
    if (rank === 0) {
      return `Top pick — highest composite score. Strong ROI (${(score.roi * 10).toFixed(1)}×) and brief alignment.`;
    }
    if (score.authenticity >= 0.85) {
      return `Premium authentic audience. Low fraud risk, above-average engagement.`;
    }
    if (score.roi >= 0.7) {
      return `High ROI potential. Recommended for performance-based campaigns.`;
    }
    if (score.briefAlignment >= 0.8) {
      return `Strong brief fit — niche and budget alignment. Good campaign cohesion.`;
    }
    const budgetLabel = brief['budget']
      ? `within $${((brief['budget'] as number) / 100).toFixed(0)} budget`
      : 'within budget';
    return `Solid all-round profile. Ranked #${rank + 1} ${budgetLabel}.`;
  }

  private buildBudgetSummary(
    shortlist: Array<{ scores: { estimatedCostCents: number; tier: string } }>,
    brief: Record<string, unknown>,
  ): Record<string, unknown> {
    const totalEstimatedCost = shortlist.reduce(
      (sum, c) => sum + (c.scores.estimatedCostCents ?? 0),
      0,
    );
    const campaignBudget = (brief['budget'] as number) ?? 0;
    const tierBreakdown: Record<string, number> = {};
    for (const c of shortlist) {
      const t = c.scores.tier ?? 'micro';
      tierBreakdown[t] = (tierBreakdown[t] ?? 0) + 1;
    }
    return {
      totalEstimatedCostCents: totalEstimatedCost,
      campaignBudgetCents: campaignBudget,
      budgetUtilisationPct:
        campaignBudget > 0
          ? Math.round((totalEstimatedCost / campaignBudget) * 100)
          : null,
      tierBreakdown,
    };
  }

  /**
   * Runs the three intelligence modules for a single creator in parallel
   * and conflict-resolves the dual-model numeric outputs.
   */
  private async executeCreatorIntelligence(
    creator: Record<string, unknown>,
    taskId: string,
  ): Promise<{
    merged: Record<string, unknown>;
    conflicts: OrchestratorResponse['conflicts'];
    moduleResults: ModuleResult[];
  }> {
    const creatorId = creator['creatorId'] as string | undefined;
    const perfPayload: Record<string, unknown> = {
      followers: creator['followers'] ?? 0,
      engagementRate: creator['engagementRate'] ?? creator['engagement_rate'] ?? 3.5,
      audienceScore: creator['audienceScore'] ?? 0.75,
      fraudScore: creator['fraudScore'] ?? 0.0,
      niche: Array.isArray(creator['niche']) ? creator['niche'][0] : (creator['niche'] ?? 'lifestyle'),
      platform: creator['platform'] ?? 'instagram',
      avgViews: creator['avgViews'],
    };
    const pricingPayload: Record<string, unknown> = {
      platform: creator['platform'] ?? 'instagram',
      contentType: creator['contentType'] ?? 'post',
      niche: Array.isArray(creator['niche']) ? creator['niche'] : ['lifestyle'],
      followersCount: creator['followers'] ?? 0,
      engagementRate: creator['engagementRate'] ?? creator['engagement_rate'] ?? 3.5,
    };

    const [graphResult, perfResult, pricingResult] = await Promise.all([
      creatorId
        ? this.executeModule(
            { moduleId: 'creator-graph-ai', method: 'runCreatorGraph', required: true, defaultConfidence: 0.78 },
            { creatorId },
            taskId,
          )
        : this.executeModule(
            { moduleId: 'performance-prediction-ai', method: 'runPerformancePredict', required: true, defaultConfidence: 0.83 },
            perfPayload,
            taskId,
          ),
      this.executeModule(
        { moduleId: 'performance-prediction-ai', method: 'runPerformancePredict', required: true, defaultConfidence: 0.83 },
        perfPayload,
        taskId,
      ),
      this.executeModule(
        { moduleId: 'pricing-engine-ai', method: 'runPricingRecommend', required: false, defaultConfidence: 0.82 },
        pricingPayload,
        taskId,
      ),
    ]);

    const moduleResults = [graphResult, perfResult, pricingResult];

    // Conflict-resolve the primary prediction models (graph + performance)
    const { merged: predictionMerged, conflicts } = this.conflictResolver.resolve(
      [graphResult, perfResult].filter(r => !r.error),
    );

    // Combine with pricing (distinct fields — no conflicts expected)
    const pricingData = pricingResult.error
      ? {}
      : (pricingResult.result as Record<string, unknown>) ?? {};

    const merged: Record<string, unknown> = {
      ...predictionMerged,
      pricing: pricingData,
    };

    return { merged, conflicts, moduleResults };
  }

  /**
   * Aggregates per-creator intelligence into a campaign-level launch plan.
   */
  private aggregateLaunchPlan(
    campaign: Record<string, unknown>,
    creatorProfiles: Array<{
      creatorId: string;
      intelligence: Record<string, unknown>;
      confidence: number;
    }>,
  ): Record<string, unknown> {
    let totalReach = 0;
    let totalBudget = 0;
    let totalConfidence = 0;
    const tierBreakdown: Record<string, number> = {};

    for (const profile of creatorProfiles) {
      const intel = profile.intelligence;

      const reach =
        (intel['predictedReach'] as number) ??
        (intel['reach_estimate'] as number) ??
        0;
      totalReach += typeof reach === 'number' ? reach : 0;

      const pricing = intel['pricing'] as Record<string, unknown> | undefined;
      const rate = (pricing?.['recommended_rate'] as number) ?? 0;
      totalBudget += typeof rate === 'number' ? rate : 0;

      totalConfidence += profile.confidence;

      const tier =
        (intel['tier'] as string) ??
        (pricing?.['tier'] as string) ??
        'micro';
      tierBreakdown[tier] = (tierBreakdown[tier] ?? 0) + 1;
    }

    const avgConfidence =
      creatorProfiles.length > 0 ? totalConfidence / creatorProfiles.length : 0;

    // Recommend the start date from the first timeline milestone or campaign input
    const recommendedLaunchDate =
      (campaign['startDate'] as string | undefined) ??
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return {
      totalEstimatedReach: Math.round(totalReach),
      totalBudgetRequiredCents: Math.round(totalBudget),
      creatorCount: creatorProfiles.length,
      avgCreatorConfidence: Math.round(avgConfidence * 100) / 100,
      tierBreakdown,
      recommendedLaunchDate,
      campaignObjective: campaign['objective'] ?? 'awareness',
      platforms: campaign['platforms'] ?? [],
    };
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

      case 'runContractRevise':
        return this.aiService.reviseContractContent(
          payload as unknown as Parameters<AiService['reviseContractContent']>[0],
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

      case 'runDeliverableFeedback':
        return this.aiService.getDeliverableFeedback(
          payload as unknown as Parameters<AiService['getDeliverableFeedback']>[0],
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
