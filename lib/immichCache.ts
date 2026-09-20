/**
 * When a cached answer from Immich may still be served — the policy on its own,
 * separated from the client that applies it (#610).
 *
 * This governs how quickly the public site reflects a change made in Immich,
 * and what visitors see while Immich is down. Inside the client it was only
 * reachable through HTTP mocks; here it is a plain function over a cache and an
 * error.
 */

import { cache } from './cache';
import { ImmichUnavailableError } from './immichTransport';

/** Cache write carrying the configured stale window. */
export function cacheSet<T>(key: string, data: T, ttlMs: number, staleMaxAgeMs: number): void {
  cache.set(key, data, ttlMs, staleMaxAgeMs);
}

/**
 * Last resort when Immich is unavailable: hand back the most recent known good
 * answer rather than failing the page.
 *
 * Only successes ever reach the cache, so this cannot resurrect an outage — and
 * past staleMaxAge the entry is gone and the error propagates as before.
 *
 * It answers only ImmichUnavailableError. Any other error means we asked the
 * wrong question, not that the answer is unavailable, and serving something
 * stale would hide a real bug behind yesterday's data.
 */
export function staleOrThrow<T>(cacheKey: string, error: unknown, label: string): T {
  if (error instanceof ImmichUnavailableError) {
    const stale = cache.getStale<T>(cacheKey);
    if (stale !== null) {
      console.warn(`[Immich] ⚠️ Upstream unavailable — serving stale ${label}`);
      return stale;
    }
  }
  throw error;
}
