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

/**
 * Cache sentinel for "Immich answered, and the resource does not exist".
 *
 * The cache cannot tell a miss from a stored null — both read back as null — so
 * absence is recorded as a distinct object identity instead.
 *
 * Only definitive 404/410 answers are stored. An outage throws
 * `ImmichUnavailableError` and is never cached: pinning one would keep the
 * gallery broken long after Immich recovered.
 *
 * Stored under the normal `cacheTtl`, and — unlike what the 2026-08-05
 * resilience plan says — **inside** the stale window, deliberately. A 404 is as
 * authoritative an answer as a 200, so during an outage "still missing" is the
 * last known good answer, exactly like a stale album is. The alternative is
 * worse than it sounds: the homepage looks up every hero ID in one
 * `Promise.all` with no catch, so a single deleted hero photo whose "missing"
 * had expired would take the whole homepage down for the length of the outage,
 * while every other image could have been served stale (#626).
 *
 * Both invalidation paths (the Immich webhook and the admin panel's
 * save/reload) clear it immediately, so a corrected ID takes effect at once.
 */
export const MISSING = Object.freeze({ __immichMissing: true });
export type Missing = typeof MISSING;

/** Cache write carrying the configured stale window. */
export function cacheSet<T>(key: string, data: T, ttlMs: number, staleMaxAgeMs: number): void {
  cache.set(key, data, ttlMs, staleMaxAgeMs);
}

/**
 * Last resort when Immich is unavailable, for keys that only ever hold real
 * data: hand back the most recent known good answer rather than failing the
 * page.
 *
 * It answers only ImmichUnavailableError. Any other error means we asked the
 * wrong question, not that the answer is unavailable, and serving something
 * stale would hide a real bug behind yesterday's data.
 *
 * It will not cast the MISSING sentinel into a `T`. That cast is what #626
 * was: a sentinel handed back as an album or an asset is a truthy object with
 * no fields, so every `if (!asset)` guard passes and the page answers 500.
 * Keys that can hold the sentinel go through staleOrMissing instead; here,
 * meeting one means there is nothing usable, and the outage propagates.
 */
export function staleOrThrow<T>(cacheKey: string, error: unknown, label: string): T {
  if (error instanceof ImmichUnavailableError) {
    const stale = cache.getStale<T | Missing>(cacheKey);
    if (stale !== null && stale !== MISSING) {
      console.warn(`[Immich] ⚠️ Upstream unavailable — serving stale ${label}`);
      return stale as T;
    }
  }
  throw error;
}

/**
 * The same fallback for keys that may hold the MISSING sentinel — a single
 * album or a single asset.
 *
 * A stale "missing" comes back as `null`, which is what the caller would have
 * got from Immich itself: the last authoritative answer was that the resource
 * does not exist, and every caller already handles `null` that way.
 */
export function staleOrMissing<T>(cacheKey: string, error: unknown, label: string): T | null {
  if (error instanceof ImmichUnavailableError) {
    const stale = cache.getStale<T | Missing>(cacheKey);
    if (stale === MISSING) {
      console.warn(`[Immich] ⚠️ Upstream unavailable — ${label} was last known missing`);
      return null;
    }
    if (stale !== null) {
      console.warn(`[Immich] ⚠️ Upstream unavailable — serving stale ${label}`);
      return stale as T;
    }
  }
  throw error;
}
