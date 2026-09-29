import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The catch-all answers one segment (subpage, content page, standalone album)
 * and two (subpage/album). A third segment used to fall through to the
 * one-segment branch, which only reads `path[0]`: `/travel/iceland/anything`
 * rendered the Travel subpage and `/iceland/x/y` the Iceland album, each with
 * a 200, under an endless supply of URLs.
 */

const NOT_FOUND = new Error('NEXT_NOT_FOUND');

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => false }));

const immich = vi.hoisted(() => ({
  isSubpageSlug: vi.fn((slug: string) => slug === 'travel'),
  getSubpageAlbums: vi.fn(),
  getAlbumBySlug: vi.fn(),
  getStandaloneAlbums: vi.fn(async () => []),
  getSubpages: vi.fn(async () => []),
  getAssetInfo: vi.fn(async () => null),
}));
vi.mock('@/lib/immich', () => ({ immich }));

const ALBUM = {
  id: 'album-1',
  albumName: 'Iceland',
  slug: 'iceland',
  assets: [],
  albumThumbnailAssetId: null,
};

import PathPage, { generateMetadata } from '../page';
import { getServerDictionary } from '@/lib/i18n/server';

const call = (path: string[]) => ({
  params: Promise.resolve({ path }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  vi.clearAllMocks();
  immich.getAlbumBySlug.mockResolvedValue(ALBUM);
  immich.getSubpageAlbums.mockResolvedValue({
    subpage: { slug: 'travel', name: 'Travel', albumIds: ['album-1', 'album-2'] },
    albums: [ALBUM, { ...ALBUM, id: 'album-2', slug: 'norway', albumName: 'Norway' }],
  });
});

describe('catch-all path depth', () => {
  it.each([[['iceland', 'x', 'y']], [['travel', 'iceland', 'extra']], [['travel', 'a', 'b', 'c']]])(
    'answers %j with a 404',
    async (path) => {
      await expect(PathPage(call(path))).rejects.toBe(NOT_FOUND);
      expect(immich.getAlbumBySlug).not.toHaveBeenCalled();
      expect(immich.getSubpageAlbums).not.toHaveBeenCalled();
    },
  );

  it('gives a three-segment path no album metadata, only the not-found title', async () => {
    const meta = await generateMetadata(call(['iceland', 'x', 'y']));
    expect(meta.title).toBe(getServerDictionary().error.notFoundTitle);
    expect(immich.getAlbumBySlug).not.toHaveBeenCalled();
  });

  it('still renders one and two segments', async () => {
    await expect(PathPage(call(['iceland']))).resolves.toBeTruthy();
    await expect(PathPage(call(['travel', 'iceland']))).resolves.toBeTruthy();
  });
});
