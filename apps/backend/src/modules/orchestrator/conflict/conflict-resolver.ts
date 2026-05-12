import { Injectable, Logger } from '@nestjs/common';
import { ModuleResult, ConflictLog, ModuleId } from '../types/orchestrator.types';

/**
 * Detects and resolves conflicts between module outputs.
 *
 * Resolution rules
 * ────────────────
 * 1. Single module    → pass through unchanged.
 * 2. Multiple modules → compare numeric fields key-by-key.
 *    a. delta ≤ 15 %  → weighted average (no conflict logged).
 *    b. delta > 15 %  → CONFLICT:
 *       • confidence gap > 10 pp  → dominant module wins.
 *       • otherwise                → weighted average.
 * 3. Non-numeric fields → highest-confidence module wins (no conflict log).
 */
const CONFLICT_DELTA_THRESHOLD = 0.15; // 15 % relative difference
const DOMINANT_CONF_GAP = 0.10;       // 10 pp confidence gap

@Injectable()
export class ConflictResolver {
  private readonly logger = new Logger(ConflictResolver.name);

  /**
   * Resolves conflicts across all module results, returning a single
   * merged object and a log of every conflict that was detected.
   */
  resolve(results: ModuleResult[]): {
    merged: Record<string, unknown>;
    conflicts: ConflictLog[];
  } {
    if (results.length === 0) return { merged: {}, conflicts: [] };
    if (results.length === 1) {
      return {
        merged: (results[0].result as Record<string, unknown>) ?? {},
        conflicts: [],
      };
    }

    const conflicts: ConflictLog[] = [];
    const merged: Record<string, unknown> = {};

    // Collect every key produced by at least one module
    const allKeys = new Set<string>();
    for (const r of results) {
      if (r.result && typeof r.result === 'object') {
        Object.keys(r.result as object).forEach(k => allKeys.add(k));
      }
    }

    for (const key of allKeys) {
      const candidates = results
        .filter(
          r =>
            r.result &&
            typeof r.result === 'object' &&
            key in (r.result as object),
        )
        .map(r => ({
          moduleId: r.moduleId,
          value: (r.result as Record<string, unknown>)[key],
          confidence: r.confidence,
        }));

      if (candidates.length === 0) continue;
      if (candidates.length === 1) {
        merged[key] = candidates[0].value;
        continue;
      }

      const numeric = candidates.filter(c => typeof c.value === 'number');

      if (numeric.length >= 2) {
        const [a, b] = numeric;
        const avg = ((a.value as number) + (b.value as number)) / 2;
        const relativeDelta = avg === 0
          ? 0
          : Math.abs((a.value as number) - (b.value as number)) / avg;

        if (relativeDelta > CONFLICT_DELTA_THRESHOLD) {
          const sorted = [...numeric].sort((x, y) => y.confidence - x.confidence);
          const [best, second] = sorted;
          const resolution: ConflictLog['resolution'] =
            best.confidence - second.confidence > DOMINANT_CONF_GAP
              ? 'dominant'
              : 'weighted-average';

          const selected =
            resolution === 'dominant'
              ? best.value
              : numeric.reduce((sum, v) => sum + (v.value as number) * v.confidence, 0) /
                numeric.reduce((sum, v) => sum + v.confidence, 0);

          const conflict: ConflictLog = {
            field: key,
            moduleA: a.moduleId as ModuleId,
            valueA: a.value,
            confidenceA: a.confidence,
            moduleB: b.moduleId as ModuleId,
            valueB: b.value,
            confidenceB: b.confidence,
            resolution,
            selected,
          };
          conflicts.push(conflict);

          this.logger.warn(
            `Conflict on "${key}": ${a.moduleId}=${a.value} (${a.confidence}) vs ` +
              `${b.moduleId}=${b.value} (${b.confidence}). ` +
              `Resolution=${resolution} → ${selected}`,
          );

          merged[key] = selected;
          continue;
        }

        // Delta within threshold: weighted average
        const totalWeight = numeric.reduce((s, v) => s + v.confidence, 0);
        merged[key] =
          numeric.reduce((sum, v) => sum + (v.value as number) * v.confidence, 0) /
          totalWeight;
      } else {
        // Non-numeric: pick highest-confidence module's value
        const best = [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
        merged[key] = best.value;
      }
    }

    return { merged, conflicts };
  }

  /**
   * Combines results from different modules into a single object by
   * merging their keys.  Used for the CREATOR_INTELLIGENCE "combine"
   * merge strategy where each module contributes different fields.
   */
  combineResults(results: ModuleResult[]): Record<string, unknown> {
    const combined: Record<string, unknown> = {};
    for (const r of results) {
      if (r.result && typeof r.result === 'object') {
        Object.assign(combined, r.result as object);
      }
    }
    return combined;
  }
}
