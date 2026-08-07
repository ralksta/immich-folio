import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cache } from '../cache';

describe('MemoryCache stale window', () => {
  beforeEach(() => {
    cache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns fresh entries from get()', () => {
    cache.set('k', { v: 1 }, 1000);
    expect(cache.get<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('returns null from get() once the ttl elapsed', () => {
    cache.set('k', { v: 1 }, 1000);
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeNull();
  });

  it('still returns the value from getStale() after the ttl elapsed', () => {
    cache.set('k', { v: 1 }, 1000, 60_000);
    vi.advanceTimersByTime(1001);
    expect(cache.getStale<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('drops the entry from getStale() past the hard max age', () => {
    cache.set('k', { v: 1 }, 1000, 5000);
    vi.advanceTimersByTime(5001);
    expect(cache.getStale('k')).toBeNull();
  });

  it('does not let get() destroy the stale fallback', () => {
    // get() must not delete an expired entry — otherwise the fallback is gone
    // the moment any caller asks for fresh data first.
    cache.set('k', { v: 1 }, 1000, 60_000);
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeNull();
    expect(cache.getStale<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('never expires stale before the ttl itself', () => {
    // A misconfigured STALE_MAX_AGE below CACHE_TTL must not shorten the fresh
    // window.
    cache.set('k', { v: 1 }, 10_000, 1000);
    vi.advanceTimersByTime(9000);
    expect(cache.get<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('evicts the oldest entry when capacity is exceeded', () => {
    for (let i = 0; i < 201; i++) cache.set(`k${i}`, i, 60_000);
    expect(cache.get('k0')).toBeNull();
    expect(cache.get('k200')).toBe(200);
  });

  it('delete() removes the entry from get() and getStale()', () => {
    cache.set('k', { v: 1 }, 1000, 60_000);
    cache.delete('k');
    expect(cache.get('k')).toBeNull();
    expect(cache.getStale('k')).toBeNull();
  });
});
