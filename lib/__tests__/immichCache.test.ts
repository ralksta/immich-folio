import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above the file, so the stubs have to be too.
const { getStale, set } = vi.hoisted(() => ({ getStale: vi.fn(), set: vi.fn() }));

vi.mock('../cache', () => ({ cache: { getStale, set } }));

import { MISSING, cacheSet, staleOrMissing, staleOrThrow } from '../immichCache';
import { ImmichUnavailableError } from '../immichTransport';

/**
 * This policy decides what visitors see while Immich is down, and it used to be
 * reachable only through HTTP mocks against the client (#610). These are the
 * tests that became possible once it stood on its own.
 */
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('staleOrThrow', () => {
  it('serves the last known good answer when Immich is unavailable', () => {
    getStale.mockReturnValue([{ id: 'album-1' }]);

    const result = staleOrThrow('albums', new ImmichUnavailableError('502'), 'albums');

    expect(result).toEqual([{ id: 'album-1' }]);
  });

  it('rethrows when nothing usable is left in the cache', () => {
    // Past staleMaxAge the entry is gone, and the outage surfaces as before.
    getStale.mockReturnValue(null);

    expect(() => staleOrThrow('albums', new ImmichUnavailableError('502'), 'albums')).toThrow(
      ImmichUnavailableError,
    );
  });

  it('does not serve stale data for an error that is not an outage', () => {
    // A TypeError means we asked the wrong question. Answering it with
    // yesterday's data would hide a real bug behind a plausible page.
    getStale.mockReturnValue([{ id: 'album-1' }]);

    expect(() => staleOrThrow('albums', new TypeError('read of undefined'), 'albums')).toThrow(
      TypeError,
    );
    expect(getStale).not.toHaveBeenCalled();
  });

  it('says so in the log when it serves something stale', () => {
    getStale.mockReturnValue(['cached']);

    staleOrThrow('albums', new ImmichUnavailableError('502'), 'album list');

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('album list'));
  });
});

describe('the MISSING sentinel (#626)', () => {
  it('is never cast into real data by staleOrThrow', () => {
    // The sentinel handed back as an album is a truthy object with no fields;
    // every `if (!album)` guard passes and the page answers 500. For a key
    // that should only ever hold data, meeting it means nothing is usable.
    getStale.mockReturnValue(MISSING);

    expect(() => staleOrThrow('albums', new ImmichUnavailableError('502'), 'albums')).toThrow(
      ImmichUnavailableError,
    );
  });

  it('comes back from staleOrMissing as null — the last authoritative answer', () => {
    getStale.mockReturnValue(MISSING);

    expect(staleOrMissing('asset-x', new ImmichUnavailableError('502'), 'asset x')).toBeNull();
  });

  it('lets staleOrMissing still serve real stale data', () => {
    getStale.mockReturnValue({ id: 'asset-x' });

    expect(staleOrMissing('asset-x', new ImmichUnavailableError('502'), 'asset x')).toEqual({
      id: 'asset-x',
    });
  });

  it('lets staleOrMissing throw when nothing is cached', () => {
    getStale.mockReturnValue(null);

    expect(() => staleOrMissing('asset-x', new ImmichUnavailableError('502'), 'asset x')).toThrow(
      ImmichUnavailableError,
    );
  });

  it('keeps staleOrMissing from answering a non-outage error', () => {
    getStale.mockReturnValue(MISSING);

    expect(() => staleOrMissing('asset-x', new TypeError('bug'), 'asset x')).toThrow(TypeError);
    expect(getStale).not.toHaveBeenCalled();
  });
});

describe('cacheSet', () => {
  it('passes the configured windows through', () => {
    cacheSet('albums', ['a'], 60_000, 3_600_000);

    expect(set).toHaveBeenCalledWith('albums', ['a'], 60_000, 3_600_000);
  });
});
