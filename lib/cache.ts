/**
 * Simple in-memory LRU cache for Immich API responses.
 * Avoids hammering the Immich server with identical requests.
 *
 * Entries carry two deadlines. `staleAt` is the normal TTL — past it, get()
 * reports a miss and callers refetch. `hardExpiresAt` is the point past which
 * the data is too old to show at all. Between the two, the entry survives as a
 * fallback that getStale() hands out when Immich is unreachable, so a
 * restarting server does not turn the gallery into an error page.
 */

interface CacheEntry<T> {
  data: T;
  staleAt: number;
  hardExpiresAt: number;
}

const DEFAULT_STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries = 200;

  get size(): number {
    return this.store.size;
  }

  /** Move an entry to the newest end of the LRU order. */
  private touch(key: string, entry: CacheEntry<unknown>): void {
    this.store.delete(key);
    this.store.set(key, entry);
  }

  /** Fresh data only. Returns null once the TTL has elapsed. */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();

    if (now > entry.hardExpiresAt) {
      this.store.delete(key);
      return null;
    }

    // Past the TTL the entry is no longer fresh, but it is deliberately kept
    // so getStale() can still use it.
    if (now > entry.staleAt) return null;

    this.touch(key, entry);
    return entry.data as T;
  }

  /**
   * Fresh *or* stale data. Only for the upstream-unreachable path — prefer
   * get() everywhere else.
   */
  getStale<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.hardExpiresAt) {
      this.store.delete(key);
      return null;
    }

    this.touch(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number, staleMaxAgeMs = DEFAULT_STALE_MAX_AGE_MS): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const now = Date.now();
    this.store.set(key, {
      data,
      staleAt: now + ttlMs,
      // Measured from write time, and never shorter than the TTL itself.
      hardExpiresAt: now + Math.max(ttlMs, staleMaxAgeMs),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new MemoryCache();
export { DEFAULT_STALE_MAX_AGE_MS };
