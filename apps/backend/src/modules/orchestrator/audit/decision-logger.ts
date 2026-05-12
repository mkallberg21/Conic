import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorResponse, OrchestratorRequest } from '../types/orchestrator.types';

export interface DecisionRecord {
  taskId: string;
  taskType: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  status: string;
  confidence: number;
  modulesUsed: string[];
  conflictCount: number;
  executionMs: number;
  timestamp: string;
  reasoning: string;
}

/**
 * In-memory ring-buffer audit log for all orchestrator decisions.
 *
 * Keeps the last MAX_HISTORY decision records (default 1 000).
 * Emits structured log lines at INFO level for every decision and
 * WARN level whenever a conflict was detected.
 */
@Injectable()
export class DecisionLogger {
  private readonly logger = new Logger('OrchestratorAudit');
  private readonly decisions: DecisionRecord[] = [];
  private readonly MAX_HISTORY = 1000;

  record(request: OrchestratorRequest, response: OrchestratorResponse): void {
    const record: DecisionRecord = {
      taskId: response.taskId,
      taskType: response.taskType,
      userId: request.context?.userId,
      sessionId: request.context?.sessionId,
      correlationId: request.context?.correlationId,
      status: response.status,
      confidence: response.confidence,
      modulesUsed: response.modulesUsed,
      conflictCount: response.conflicts.length,
      executionMs: response.executionMs,
      timestamp: response.timestamp,
      reasoning: response.reasoning,
    };

    if (this.decisions.length >= this.MAX_HISTORY) {
      this.decisions.shift();
    }
    this.decisions.push(record);

    this.logger.log(
      `[${record.taskId}] ${record.taskType} → ${record.status} ` +
        `| confidence=${record.confidence} ` +
        `| modules=[${record.modulesUsed.join(',')}] ` +
        `| conflicts=${record.conflictCount} ` +
        `| ${record.executionMs}ms`,
    );

    if (response.conflicts.length > 0) {
      for (const c of response.conflicts) {
        this.logger.warn(
          `[${record.taskId}] Conflict resolved: field="${c.field}" ` +
            `${c.moduleA}=${c.valueA} vs ${c.moduleB}=${c.valueB} ` +
            `→ resolution=${c.resolution}, selected=${c.selected}`,
        );
      }
    }
  }

  getHistory(limit = 50): DecisionRecord[] {
    return this.decisions.slice(-Math.min(limit, this.MAX_HISTORY)).reverse();
  }

  getStats(): Record<string, unknown> {
    const total = this.decisions.length;
    if (total === 0) return { total: 0 };

    const successful = this.decisions.filter(d => d.status === 'success').length;
    const avgConfidence = this.decisions.reduce((s, d) => s + d.confidence, 0) / total;
    const avgExecutionMs = this.decisions.reduce((s, d) => s + d.executionMs, 0) / total;
    const totalConflicts = this.decisions.reduce((s, d) => s + d.conflictCount, 0);

    const byTaskType: Record<string, number> = {};
    for (const d of this.decisions) {
      byTaskType[d.taskType] = (byTaskType[d.taskType] ?? 0) + 1;
    }

    return {
      total,
      successRate: Math.round((successful / total) * 100),
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      avgExecutionMs: Math.round(avgExecutionMs),
      totalConflicts,
      conflictsPerTask: Math.round((totalConflicts / total) * 100) / 100,
      byTaskType,
    };
  }
}
