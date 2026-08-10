import { describe, it, expect } from 'vitest';

import {
  ALBUM_SORT_MODES,
  isAlbumSortMode,
  sortAlbumAssets,
  type AlbumSortMode,
  type SortableAsset,
} from '@/lib/albumSort';

function asset(id: string, overrides: Partial<SortableAsset> = {}): SortableAsset {
  return {
    id,
    originalFileName: `${id}.jpg`,
    fileCreatedAt: '2024-01-01T00:00:00.000Z',
    localDateTime: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ids = (assets: SortableAsset[]) => assets.map((a) => a.id);

describe('sortAlbumAssets is pure', () => {
  it('returns a new array and leaves the input untouched', () => {
    const input = [
      asset('b', { localDateTime: '2024-02-01T00:00:00.000Z' }),
      asset('a', { localDateTime: '2024-01-01T00:00:00.000Z' }),
    ];
    const before = ids(input);

    const out = sortAlbumAssets(input, { mode: 'oldest' });

    expect(out).not.toBe(input);
    expect(ids(input)).toEqual(before);
  });

  // The cached album is shared, so any mode that dropped or duplicated an asset
  // would corrupt what every later request sees. This is the guard that any
  // future rewrite of the manual branch has to survive.
  it.each(ALBUM_SORT_MODES)('preserves the exact set of assets under %s', (mode) => {
    const input = [asset('a'), asset('b'), asset('c'), asset('d')];

    const out = sortAlbumAssets(input, {
      mode: mode as AlbumSortMode,
      immichOrder: 'asc',
      manualOrder: ['c', 'zzz'],
    });

    expect(out).toHaveLength(input.length);
    expect(ids(out).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('capture-time modes', () => {
  const jan = asset('jan', { localDateTime: '2024-01-01T00:00:00.000Z' });
  const feb = asset('feb', { localDateTime: '2024-02-01T00:00:00.000Z' });
  const mar = asset('mar', { localDateTime: '2024-03-01T00:00:00.000Z' });

  it('orders newest first', () => {
    expect(ids(sortAlbumAssets([jan, mar, feb], { mode: 'newest' }))).toEqual([
      'mar',
      'feb',
      'jan',
    ]);
  });

  it('orders oldest first, exactly reversing newest', () => {
    const input = [jan, mar, feb];
    expect(ids(sortAlbumAssets(input, { mode: 'oldest' }))).toEqual(
      ids(sortAlbumAssets(input, { mode: 'newest' })).reverse(),
    );
  });

  it('falls back to fileCreatedAt when localDateTime ties', () => {
    const early = asset('early', {
      localDateTime: '2024-01-01T00:00:00.000Z',
      fileCreatedAt: '2024-01-01T08:00:00.000Z',
    });
    const late = asset('late', {
      localDateTime: '2024-01-01T00:00:00.000Z',
      fileCreatedAt: '2024-01-01T20:00:00.000Z',
    });

    expect(ids(sortAlbumAssets([late, early], { mode: 'oldest' }))).toEqual(['early', 'late']);
  });

  // Date.parse() on garbage yields NaN, and a comparator returning NaN makes
  // sort() incoherent — the result depends on the engine's algorithm, not the data.
  it('treats an unparseable date as epoch rather than producing NaN', () => {
    const broken = asset('broken', { localDateTime: 'not-a-date', fileCreatedAt: 'also-not' });

    const out = sortAlbumAssets([feb, broken, jan], { mode: 'oldest' });

    expect(ids(out)).toEqual(['broken', 'jan', 'feb']);
  });

  it('immich follows the album direction', () => {
    const input = [feb, jan, mar];
    expect(ids(sortAlbumAssets(input, { mode: 'immich', immichOrder: 'asc' }))).toEqual([
      'jan',
      'feb',
      'mar',
    ]);
    expect(ids(sortAlbumAssets(input, { mode: 'immich', immichOrder: 'desc' }))).toEqual([
      'mar',
      'feb',
      'jan',
    ]);
  });
});

describe('filename mode', () => {
  it('collates numerically, so IMG_2 precedes IMG_10', () => {
    const input = [
      asset('c', { originalFileName: 'IMG_10.jpg' }),
      asset('a', { originalFileName: 'IMG_2.jpg' }),
      asset('b', { originalFileName: 'IMG_9.jpg' }),
    ];

    expect(ids(sortAlbumAssets(input, { mode: 'filename' }))).toEqual(['a', 'b', 'c']);
  });

  it('is case-insensitive', () => {
    const input = [
      asset('b', { originalFileName: 'beta.jpg' }),
      asset('a', { originalFileName: 'Alpha.jpg' }),
    ];

    expect(ids(sortAlbumAssets(input, { mode: 'filename' }))).toEqual(['a', 'b']);
  });

  // Duplicate filenames across import batches are common; without the id
  // tiebreak the order of a tie would follow the input and drift per request.
  it('breaks ties on id so the order is stable', () => {
    const one = asset('aaa', { originalFileName: 'DSC.jpg' });
    const two = asset('bbb', { originalFileName: 'dsc.jpg' });

    expect(ids(sortAlbumAssets([two, one], { mode: 'filename' }))).toEqual(['aaa', 'bbb']);
    expect(ids(sortAlbumAssets([one, two], { mode: 'filename' }))).toEqual(['aaa', 'bbb']);
  });
});

describe('manual mode is a pinned prefix', () => {
  const a = asset('a', { localDateTime: '2024-01-01T00:00:00.000Z' });
  const b = asset('b', { localDateTime: '2024-02-01T00:00:00.000Z' });
  const c = asset('c', { localDateTime: '2024-03-01T00:00:00.000Z' });

  it('puts pinned assets first, in the pinned order', () => {
    const out = sortAlbumAssets([a, b, c], {
      mode: 'manual',
      immichOrder: 'asc',
      manualOrder: ['c', 'a'],
    });

    expect(ids(out)).toEqual(['c', 'a', 'b']);
  });

  it('appends unpinned assets in the album Immich order', () => {
    const desc = sortAlbumAssets([a, b, c], {
      mode: 'manual',
      immichOrder: 'desc',
      manualOrder: ['a'],
    });
    const asc = sortAlbumAssets([a, b, c], {
      mode: 'manual',
      immichOrder: 'asc',
      manualOrder: ['a'],
    });

    expect(ids(desc)).toEqual(['a', 'c', 'b']);
    expect(ids(asc)).toEqual(['a', 'b', 'c']);
  });

  // The album can change in Immich after the order was saved; a stale id must
  // not shift or drop anything.
  it('ignores pinned ids that are no longer in the album', () => {
    const out = sortAlbumAssets([a, b], {
      mode: 'manual',
      immichOrder: 'asc',
      manualOrder: ['gone', 'b'],
    });

    expect(ids(out)).toEqual(['b', 'a']);
  });

  it('pins a duplicated id once, at its first position', () => {
    const out = sortAlbumAssets([a, b, c], {
      mode: 'manual',
      immichOrder: 'asc',
      manualOrder: ['c', 'a', 'c'],
    });

    expect(ids(out)).toEqual(['c', 'a', 'b']);
  });

  it('falls back to the album order when nothing is pinned', () => {
    const input = [c, a, b];
    expect(ids(sortAlbumAssets(input, { mode: 'manual', immichOrder: 'asc' }))).toEqual(
      ids(sortAlbumAssets(input, { mode: 'immich', immichOrder: 'asc' })),
    );
  });
});

describe('isAlbumSortMode', () => {
  it('accepts every declared mode and nothing else', () => {
    for (const mode of ALBUM_SORT_MODES) expect(isAlbumSortMode(mode)).toBe(true);
    expect(isAlbumSortMode('bogus')).toBe(false);
    expect(isAlbumSortMode(undefined)).toBe(false);
    expect(isAlbumSortMode(null)).toBe(false);
  });
});
