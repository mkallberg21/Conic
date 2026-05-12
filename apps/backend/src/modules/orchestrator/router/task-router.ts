import { Injectable } from '@nestjs/common';
import { TaskType, ModuleId } from '../types/orchestrator.types';

// ─── Execution Plan Types ─────────────────────────────────────────────────────

export interface ExecutionStep {
  moduleId: ModuleId;
  /** Method name dispatched in OrchestratorService.dispatchToModule() */
  method: string;
  /** If true and the module fails, the entire task fails. */
  required: boolean;
  /** Fallback confidence when the module output carries none. */
  defaultConfidence: number;
}

export type MergeStrategy = 'first' | 'combine' | 'confidence-weighted' | 'compound';

export interface ExecutionPlan {
  /**
   * 2-D array: outer = sequential stages, inner = steps run in parallel
   * within that stage.
   * Empty for compound tasks — the orchestrator handles fan-out directly.
   */
  steps: ExecutionStep[][];
  mergeStrategy: MergeStrategy;
  description: string;
  /** When set, the orchestrator delegates to a named compound handler. */
  compoundHandler?: string;
}

// ─── Task → Execution Plan Registry ──────────────────────────────────────────

const PLANS: Record<TaskType, ExecutionPlan> = {
  // ── Contracts ──────────────────────────────────────────────────────────────
  CONTRACT_GENERATE: {
    steps: [
      [
        {
          moduleId: 'contract-ai',
          method: 'runContractGenerate',
          required: true,
          defaultConfidence: 0.85,
        },
      ],
    ],
    mergeStrategy: 'first',
    description: 'Generate full contract content via contract-ai',
  },

  CONTRACT_RISK: {
    steps: [
      [
        {
          moduleId: 'contract-ai',
          method: 'runContractRisk',
          required: true,
          defaultConfidence: 0.80,
        },
      ],
    ],
    mergeStrategy: 'first',
    description: 'Score contract risk flags via contract-ai',
  },

  // ── Deliverables ───────────────────────────────────────────────────────────
  DELIVERABLE_VERIFY: {
    steps: [
      [
        {
          moduleId: 'deliverable-verification-ai',
          method: 'runDeliverableVerify',
          required: true,
          defaultConfidence: 0.90,
        },
      ],
    ],
    mergeStrategy: 'first',
    description: 'Verify deliverable content compliance via deliverable-verification-ai',
  },

  // ── Pricing ────────────────────────────────────────────────────────────────
  PRICING_RECOMMEND: {
    steps: [
      [
        {
          moduleId: 'pricing-engine-ai',
          method: 'runPricingRecommend',
          required: true,
          defaultConfidence: 0.82,
        },
      ],
    ],
    mergeStrategy: 'first',
    description: 'Market-aware creator rate recommendation via pricing-engine-ai',
  },

  // ── Creator: single compound prediction (two models, conflict resolution) ──
  CREATOR_PREDICT: {
    steps: [
      [
        {
          moduleId: 'creator-graph-ai',
          method: 'runCreatorGraph',
          required: true,
          defaultConfidence: 0.78,
        },
        {
          moduleId: 'performance-prediction-ai',
          method: 'runPerformancePredict',
          required: true,
          defaultConfidence: 0.83,
        },
      ],
    ],
    mergeStrategy: 'confidence-weighted',
    description:
      'Dual-model creator performance prediction — graph-ai + performance-ai run in parallel; orchestrator resolves conflicts',
  },

  // ── Creator: full intelligence report (graph + performance + pricing) ──────
  CREATOR_INTELLIGENCE: {
    steps: [
      [
        {
          moduleId: 'creator-graph-ai',
          method: 'runCreatorGraph',
          required: true,
          defaultConfidence: 0.78,
        },
        {
          moduleId: 'performance-prediction-ai',
          method: 'runPerformancePredict',
          required: true,
          defaultConfidence: 0.83,
        },
        {
          moduleId: 'pricing-engine-ai',
          method: 'runPricingRecommend',
          required: false, // pricing is enrichment, not blocking
          defaultConfidence: 0.82,
        },
      ],
    ],
    mergeStrategy: 'combine',
    description:
      'Full creator intelligence: graph-ai + performance-ai + pricing-engine merged into one report',
  },

  // ── Campaigns ──────────────────────────────────────────────────────────────
  CAMPAIGN_TIMELINE: {
    steps: [
      [
        {
          moduleId: 'campaign-agent-ai',
          method: 'runCampaignTimeline',
          required: true,
          defaultConfidence: 0.87,
        },
      ],
    ],
    mergeStrategy: 'first',
    description: 'AI-generated campaign timeline via campaign-agent-ai',
  },

  CAMPAIGN_DEBRIEF: {
    steps: [
      [
        {
          moduleId: 'campaign-agent-ai',
          method: 'runCampaignDebrief',
          required: true,
          defaultConfidence: 0.88,
        },
      ],
    ],
    mergeStrategy: 'first',
    description: 'End-of-campaign debrief + PDF export via campaign-agent-ai',
  },

  // ── Compound: full launch plan (timeline + per-creator intelligence) ────────
  CAMPAIGN_INTELLIGENCE: {
    steps: [], // fan-out handled directly by OrchestratorService
    mergeStrategy: 'compound',
    compoundHandler: 'campaignIntelligence',
    description:
      'Full campaign launch plan — timeline from campaign-agent-ai + per-creator ' +
      'intelligence (graph-ai + performance-ai + pricing-engine-ai) executed in ' +
      'parallel for all creators; conflict-resolved and merged into one launch plan',
  },

  // ── Compound: AI-ranked creator shortlist from a candidate pool ────────────
  CREATOR_ROSTER: {
    steps: [], // fan-out handled directly by OrchestratorService
    mergeStrategy: 'compound',
    compoundHandler: 'creatorRoster',
    description:
      'Score every candidate creator via creator-graph-ai + performance-prediction-ai ' +
      '+ pricing-engine-ai, then rank by predicted ROI and return an ordered shortlist ' +
      'with recommendations, conflict resolution per candidate, and budget summary',
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────

@Injectable()
export class TaskRouter {
  resolve(taskType: TaskType): ExecutionPlan {
    const plan = PLANS[taskType];
    if (!plan) throw new Error(`Unknown task type: ${taskType}`);
    return plan;
  }

  listTaskTypes(): TaskType[] {
    return Object.keys(PLANS) as TaskType[];
  }
}
