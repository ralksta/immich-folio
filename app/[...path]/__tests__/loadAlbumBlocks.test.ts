import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JournalBlock } from '@/lib/journal';

const getAlbumAssetsRaw = vi.fn();
vi.mock('@/lib/immich', () => ({
  immich: {
    get getAlbumAssetsRaw() {
      return getAlbumAssetsRaw;
    },
  },
}));

import { loadAlbumBlocks } from '../essayPayload';

const album = (albumId: string) => ({ type: 'album', albumId, line: 0 }) as unknown as JournalBlock;
const photo = { type: 'photo', line: 0 } as unknown as JournalBlock;

describe('loadAlbumBlocks', () => {
  beforeEach(() => {
    getAlbumAssetsRaw.mockReset();
  });

  // It used to await each album before asking for the next, so a page with
  // three album blocks waited for three Immich round trips in a row.
  it('asks for every album before any answer arrives', async () => {
    const pending: Array<() => void> = [];
    getAlbumAssetsRaw.mockImplementation(
      (id: string) =>
        new Promise((resolve) => pending.push(() => resolve([{ id: `${id}-asset` }]))),
    );

    const result = loadAlbumBlocks([album('a'), photo, album('b'), album('c')], () => {});
    await Promise.resolve();

    expect(getAlbumAssetsRaw).toHaveBeenCalledTimes(3);
    pending.forEach((resolve) => resolve());
    expect([...(await result).keys()]).toEqual(['a', 'b', 'c']);
  });

  it('loads an album named by two blocks once', async () => {
    getAlbumAssetsRaw.mockResolvedValue([]);

    await loadAlbumBlocks([album('a'), album('a')], () => {});

    expect(getAlbumAssetsRaw).toHaveBeenCalledTimes(1);
  });

  it('leaves out an album that fails and reports it, keeping the rest', async () => {
    const failure = new Error('immich down');
    getAlbumAssetsRaw.mockImplementation(async (id: string) => {
      if (id === 'b') throw failure;
      return [{ id: `${id}-asset` }];
    });
    const onError = vi.fn();

    const result = await loadAlbumBlocks([album('a'), album('b'), album('c')], onError);

    expect([...result.keys()]).toEqual(['a', 'c']);
    expect(onError).toHaveBeenCalledWith('b', failure);
  });
});
