import { Injectable } from '@nestjs/common';
import {
  ModuleResult,
  OrchestratorResponse,
  ConflictLog,
  TaskType,
  ModuleId,
} from '../types/orchestrator.types';

/**
 * Enforces the unified output contract for every AI response.
 *
 * All responses leaving the orchestrator layer must conform to
 * OrchestratorResponse regardless of which module(s) produced them.
 */
@Injectable()
export class OutputNormalizer {
  normalize(
    taskId: string,
    taskType: TaskType,
    moduleResults: ModuleResult[],
    conflicts: ConflictLog[],
    mergedResult: Record<string, unknown>,
    executionMs: number,
    reasoning: string,
  ): OrchestratorResponse {
    const successful = moduleResults.filter(r => !r.error);
    const failed = moduleResults.filter(r => r.error);

    let status: OrchestratorResponse['status'];
    if (successful.length === 0) {
      status = 'failed';
    } else if (failed.length > 0) {
      status = 'partial';
    } else {
      status = 'success';
    }

    const aggregateConfidence =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length
        : 0;

    return {
      taskId,
      taskType,
      status,
      result: this.applyOutputContract(mergedResult),
      confidence: Math.round(aggregateConfidence * 100) / 100,
      modulesUsed: successful.map(r => r.moduleId as ModuleId),
      conflicts,
      reasoning,
      executionMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Coerce common type mismatches so consumers always receive consistent types:
   * • numeric strings → numbers
   * • confidence values outside 0–1 from percentage scale → normalised
   */
  applyOutputContract(result: Record<string, unknown>): Record<string, unknown> {
    const normalised: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
        normalised[key] = Number(value);
      } else if (
        (key === 'confidence' || key === 'confidence_score') &&
        typeof value === 'number' &&
        value > 1
      ) {
        // Convert percentage (e.g. 85) to fractional (0.85)
        normalised[key] = value / 100;
      } else {
        normalised[key] = value;
      }
    }
    return normalised;
  }
}
