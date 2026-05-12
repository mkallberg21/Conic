// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskType =
  | 'CONTRACT_GENERATE'
  | 'CONTRACT_RISK'
  | 'DELIVERABLE_VERIFY'
  | 'PRICING_RECOMMEND'
  | 'CREATOR_PREDICT'
  | 'CREATOR_INTELLIGENCE'
  | 'CAMPAIGN_TIMELINE'
  | 'CAMPAIGN_DEBRIEF'
  | 'CAMPAIGN_INTELLIGENCE'
  | 'CREATOR_ROSTER'
  | 'CONTRACT_INTELLIGENCE';

// ─── Module IDs ───────────────────────────────────────────────────────────────

export type ModuleId =
  | 'contract-ai'
  | 'deliverable-verification-ai'
  | 'pricing-engine-ai'
  | 'performance-prediction-ai'
  | 'creator-graph-ai'
  | 'campaign-agent-ai';

// ─── Request / Response ───────────────────────────────────────────────────────

export interface OrchestratorRequest {
  taskType: TaskType;
  payload: Record<string, unknown>;
  context?: {
    sessionId?: string;
    userId?: string;
    correlationId?: string;
    priority?: 'high' | 'normal' | 'low';
    [key: string]: unknown;
  };
}

export interface ModuleResult {
  moduleId: ModuleId;
  result: unknown;
  /** normalised 0–1 confidence extracted from the module output */
  confidence: number;
  durationMs: number;
  error?: string;
}

export interface ConflictLog {
  field: string;
  moduleA: ModuleId;
  valueA: unknown;
  confidenceA: number;
  moduleB: ModuleId;
  valueB: unknown;
  confidenceB: number;
  resolution: 'dominant' | 'weighted-average';
  selected: unknown;
}

export interface OrchestratorResponse {
  taskId: string;
  taskType: TaskType;
  /** success = all required modules ok; partial = some failed; failed = all failed */
  status: 'success' | 'partial' | 'failed';
  result: Record<string, unknown>;
  /** aggregate confidence 0–1 */
  confidence: number;
  modulesUsed: ModuleId[];
  conflicts: ConflictLog[];
  reasoning: string;
  executionMs: number;
  timestamp: string;
}
