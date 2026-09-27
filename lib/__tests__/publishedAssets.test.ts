import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * GHSA-gfh4-6275-9gqv: the media routes serve only assets the site shows. Each
 * source that puts an asset on a public page must land in the set, or that
 * page loses its photos; nothing else may.
 */

const state = vi.hoisted(() => ({
  config: {
    albums: ['album-pub'],
    heroImages: ['hero-1'],
    albumHeroImages: { 'album-pub': 'album-hero' } as Record<string, string>,
    subpages: [{ essayText: '![album:album-essay](x)' }] as Array<{ essayText?: string }>,
    cacheTtl: 300,
  },
  albums: {
    'album-pub': { albumThumbnailAssetId: 'thumb', assets: [{ id: 'a1' }, { id: 'a2' }] },
  } as Record<string, { albumThumbnailAssetId: string | null; assets: { id: string }[] }>,
  raw: {
    'album-journal': [{ id: 'j-album-1' }],
    'album-essay': [{ id: 'essay-1' }],
  } as Record<string, { id: string }[]>,
  proofAlbums: {
    'album-proof': { albumThumbnailAssetId: null, assets: [{ id: 'proof-1' }] },
    'album-expired': { albumThumbnailAssetId: null, assets: [{ id: 'expired-1' }] },
  } as Record<string, { albumThumbnailAssetId: string | null; assets: { id: string }[] }>,
  builds: 0,
  mtime: 1,
}));

vi.mock('../config', () => ({ getConfig: () => state.config }));

vi.mock('../immich', () => ({
  immich: {
    getAlbum: async (id: string) => {
      state.builds += id === 'album-pub' ? 1 : 0;
      return state.albums[id] ?? null;
    },
    getProofingAlbum: async (id: string) => state.proofAlbums[id] ?? null,
    getAlbumAssetsRaw: async (id: string) => state.raw[id] ?? [],
  },
}));

vi.mock('../admin/journal-service', () => ({
  listJournalEntries: async () => [{ slug: 'trip' }, { slug: 'draft' }],
  readJournalEntry: async (slug: string) => ({
    slug,
    rawMarkdown: '',
    parsed:
      slug === 'trip'
        ? {
            frontmatter: { coverAssetId: 'j-cover' },
            blocks: [
              { type: 'photo', assetId: 'j-photo', layout: 'wide' },
              { type: 'album', albumId: 'album-journal', layout: 'grid' },
            ],
          }
        : { frontmatter: {}, blocks: [{ type: 'photo', assetId: 'draft-photo', layout: 'wide' }] },
  }),
}));

vi.mock('../journal', async (orig) => {
  const actual = await orig<typeof import('../journal')>();
  return {
    ...actual,
    parseJournalMarkdown: (md: string) =>
      md.includes('album:album-essay')
        ? { frontmatter: {}, blocks: [{ type: 'album', albumId: 'album-essay', layout: 'grid' }] }
        : actual.parseJournalMarkdown(md),
  };
});

vi.mock('../proofSessions', () => ({
  listSessions: async () => [
    { albumId: 'album-proof', expiresOn: undefined },
    { albumId: 'album-expired', expiresOn: '2000-01-01' },
  ],
  isExpired: (s: { expiresOn?: string }) => s.expiresOn === '2000-01-01',
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: async () => '---\nportrait: portrait-1\n---\nBio',
    stat: async () => ({ mtimeMs: state.mtime }),
  },
}));

import { isPublishedAsset, resetPublishedAssetsForTest } from '../publishedAssets';

beforeEach(() => {
  resetPublishedAssetsForTest();
  state.builds = 0;
});

describe('isPublishedAsset', () => {
  it.each([
    ['an album photo', 'a1'],
    ['an album thumbnail', 'thumb'],
    ['a homepage hero', 'hero-1'],
    ['an album hero', 'album-hero'],
    ['the about portrait', 'portrait-1'],
    ['a journal cover', 'j-cover'],
    ['a journal photo block', 'j-photo'],
    ["a journal album block's photo", 'j-album-1'],
    ['a draft entry photo (its page gate hides it)', 'draft-photo'],
    ["an inline essay's album block photo", 'essay-1'],
    ['a photo of an open proofing link', 'proof-1'],
  ])('serves %s', async (_label, id) => {
    expect(await isPublishedAsset(id)).toBe(true);
  });

  it('refuses a photo of an expired proofing link', async () => {
    expect(await isPublishedAsset('expired-1')).toBe(false);
  });

  it('refuses any other asset in the library', async () => {
    expect(await isPublishedAsset('never-published')).toBe(false);
  });

  it('builds once and rebuilds on a miss at most every ten seconds', async () => {
    await isPublishedAsset('a1');
    await isPublishedAsset('a2');
    expect(state.builds).toBe(1);

    await isPublishedAsset('unknown-1'); // forced rebuild
    await isPublishedAsset('unknown-2'); // throttled
    expect(state.builds).toBe(2);
  });

  it('rebuilds at once when a content file changes, e.g. a revoked link', async () => {
    expect(await isPublishedAsset('proof-1')).toBe(true);
    delete state.proofAlbums['album-proof'].assets[0];
    state.proofAlbums['album-proof'].assets = [];
    state.mtime += 1; // proofing.json rewritten by the admin
    await new Promise((r) => setTimeout(r, 2100));
    try {
      expect(await isPublishedAsset('proof-1')).toBe(false);
    } finally {
      state.proofAlbums['album-proof'].assets = [{ id: 'proof-1' }];
    }
  }, 10_000);

  it('picks up an asset published since the last build', async () => {
    await isPublishedAsset('a1');
    state.albums['album-pub'].assets.push({ id: 'new-photo' });
    try {
      expect(await isPublishedAsset('new-photo')).toBe(true);
    } finally {
      state.albums['album-pub'].assets.pop();
    }
  });
});
