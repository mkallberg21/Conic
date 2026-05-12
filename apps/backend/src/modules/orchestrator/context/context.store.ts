import { Injectable } from '@nestjs/common';

interface ContextEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Short-term session-scoped context store.
 *
 * Keeps cross-call state (previous results, user preferences) in memory
 * for the duration of a session (default 30 min TTL). A scheduled purge
 * removes expired entries to prevent unbounded growth.
 */
@Injectable()
export class ContextStore {
  private readonly store = new Map<string, Map<string, ContextEntry>>();
  private readonly DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

  set(sessionId: string, key: string, value: unknown, ttlMs = this.DEFAULT_TTL_MS): void {
    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, new Map());
    }
    this.store.get(sessionId)!.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T = unknown>(sessionId: string, key: string): T | undefined {
    const session = this.store.get(sessionId);
    if (!session) return undefined;
    const entry = session.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      session.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  getSession(sessionId: string): Record<string, unknown> {
    const session = this.store.get(sessionId);
    if (!session) return {};
    const now = Date.now();
    const result: Record<string, unknown> = {};
    for (const [key, entry] of session.entries()) {
      if (now <= entry.expiresAt && !key.startsWith('__')) {
        result[key] = entry.value;
      }
    }
    return result;
  }

  appendDecision(sessionId: string, decision: unknown): void {
    const history = this.get<unknown[]>(sessionId, '__decision_history') ?? [];
    history.push(decision);
    if (history.length > 50) history.shift(); // ring buffer, last 50
    this.set(sessionId, '__decision_history', history);
  }

  getDecisionHistory(sessionId: string): unknown[] {
    return this.get<unknown[]>(sessionId, '__decision_history') ?? [];
  }

  /** Remove expired entries across all sessions (call periodically). */
  purgeExpired(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.store.entries()) {
      for (const [key, entry] of session.entries()) {
        if (now > entry.expiresAt) session.delete(key);
      }
      if (session.size === 0) this.store.delete(sessionId);
    }
  }
}
