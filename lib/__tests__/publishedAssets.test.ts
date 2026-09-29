import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * GHSA-gfh4-6275-9gqv: the media routes serve only assets the site shows. Each
 * source that puts an asset on a public page must land in the set, or that
 * page loses its photos; nothing else may.
 */

const state = vi.hoisted(() => ({
  config: {
    albums: ['album-pub', 'album-offline'],
    standaloneAlbums: ['album-pub'],
    heroImages: ['hero-1'],
    albumHeroImages: {
      'album-pub': 'album-hero',
      'album-offline': 'offline-hero',
    } as Record<string, string>,
    subpages: [
      { albumIds: [], enabled: true, essayText: '![album:album-essay](x)' },
      // Taken offline with `enabled: false`: its albums stay on the allowlist.
      {
        albumIds: ['album-offline'],
        enabled: false,
        essayText: '![album:album-offline-essay](x)',
      },
    ] as Array<{ albumIds: string[]; enabled: boolean; essayText?: string }>,
    cacheTtl: 300,
  },
  albums: {
    'album-pub': { albumThumbnailAssetId: 'thumb', assets: [{ id: 'a1' }, { id: 'a2' }] },
    'album-offline': { albumThumbnailAssetId: 'offline-thumb', assets: [{ id: 'offline-1' }] },
  } as Record<string, { albumThumbnailAssetId: string | null; assets: { id: string }[] }>,
  raw: {
    'album-journal': [{ id: 'j-album-1' }],
    'album-essay': [{ id: 'essay-1' }],
    'album-offline-essay': [{ id: 'offline-essay-1' }],
    'album-page': [{ id: 'page-album-1' }],
  } as Record<string, { id: string }[]>,
  proofAlbums: {
    'album-proof': { albumThumbnailAssetId: null, assets: [{ id: 'proof-1' }] },
    'album-expired': { albumThumbnailAssetId: null, assets: [{ id: 'expired-1' }] },
  } as Record<string, { albumThumbnailAssetId: string | null; assets: { id: string }[] }>,
  builds: 0,
  mtime: 1,
  /** While set, a proofing album lookup reads its answer, then waits for it. */
  gate: null as Promise<void> | null,
  onGate: null as (() => void) | null,
}));

vi.mock('../config', () => ({ getConfig: () => state.config }));

vi.mock('../immich', () => ({
  immich: {
    getAlbum: async (id: string) => {
      state.builds += id === 'album-pub' ? 1 : 0;
      return state.albums[id] ?? null;
    },
    getProofingAlbum: async (id: string) => {
      const album = state.proofAlbums[id];
      const answer = album ? { ...album, assets: [...album.assets] } : null;
      if (state.gate) {
        state.onGate?.();
        await state.gate;
      }
      return answer;
    },
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

vi.mock('../admin/pages-service', () => ({
  listPages: async () => [{ slug: 'pricing', frontmatter: {} }],
  readPage: async (slug: string) => ({
    slug,
    rawMarkdown: '',
    parsed: {
      frontmatter: { draft: true },
      blocks: [
        { type: 'photo', assetId: 'page-photo', layout: 'wide' },
        { type: 'album', albumId: 'album-page', layout: 'grid' },
        {
          type: 'map',
          line: true,
          items: [{ kind: 'photo', assetId: 'page-map-photo' }],
        },
      ],
    },
  }),
}));

vi.mock('../journal', async (orig) => {
  const actual = await orig<typeof import('../journal')>();
  return {
    ...actual,
    parseJournalMarkdown: (md: string) => {
      const albumId = /album:([\w-]+)/.exec(md)?.[1];
      return albumId
        ? { frontmatter: {}, blocks: [{ type: 'album', albumId, layout: 'grid' }] }
        : actual.parseJournalMarkdown(md);
    },
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
    ['a content page photo block (draft included)', 'page-photo'],
    ["a content page album block's photo", 'page-album-1'],
    ['a photo of an open proofing link', 'proof-1'],
  ])('serves %s', async (_label, id) => {
    expect(await isPublishedAsset(id)).toBe(true);
  });

  it('refuses a photo of an expired proofing link', async () => {
    expect(await isPublishedAsset('expired-1')).toBe(false);
  });

  it('refuses a photo only a content page map block names (maps do not render on pages)', async () => {
    expect(await isPublishedAsset('page-map-photo')).toBe(false);
  });

  it.each([
    ['a photo of its album', 'offline-1'],
    ['its album thumbnail', 'offline-thumb'],
    ['its album hero', 'offline-hero'],
    ["an album block's photo in its inline essay", 'offline-essay-1'],
  ])('refuses %s once a subpage is offline', async (_label, id) => {
    expect(await isPublishedAsset(id)).toBe(false);
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
    try {
      expect(await isPublishedAsset('proof-1')).toBe(false);
    } finally {
      state.proofAlbums['album-proof'].assets = [{ id: 'proof-1' }];
    }
  });

  /**
   * The files used to be checked at most every 2 s. A request in that window
   * after a save was answered from the set before it — with `immutable`, so
   * the browser kept the photo.
   */
  it('sees a save made milliseconds after the previous check', async () => {
    expect(await isPublishedAsset('proof-1')).toBe(true);
    expect(await isPublishedAsset('a1')).toBe(true); // a check a moment ago
    state.proofAlbums['album-proof'].assets = [];
    state.mtime += 1;
    try {
      expect(await isPublishedAsset('proof-1')).toBe(false);
    } finally {
      state.proofAlbums['album-proof'].assets = [{ id: 'proof-1' }];
    }
  });

  /**
   * A request that finds a build already running joins it. When that build
   * read the content before the save, its set must not answer for a request
   * that saw the save.
   */
  it('does not answer from a build that read the content before the save', async () => {
    expect(await isPublishedAsset('proof-1')).toBe(true);

    let release!: () => void;
    state.gate = new Promise<void>((r) => (release = r));
    const reached = new Promise<void>((r) => (state.onGate = r));
    state.mtime += 1; // an unrelated save starts a rebuild…
    const first = isPublishedAsset('a1');
    await reached; // …which has read the proofing album and is waiting on Immich

    state.proofAlbums['album-proof'].assets = [];
    state.mtime += 1; // the link is revoked
    const second = isPublishedAsset('proof-1');

    state.gate = null;
    state.onGate = null;
    release();
    try {
      expect(await first).toBe(true);
      expect(await second).toBe(false);
    } finally {
      state.proofAlbums['album-proof'].assets = [{ id: 'proof-1' }];
    }
  });

  /**
   * The first view of a newly published album: a burst of image requests for
   * photos the set has never seen. Only the first one rebuilt; the rest hit
   * the rebuild throttle and were refused while that rebuild was still
   * running — 11 of 13 photos broken until a reload.
   */
  describe('a burst of requests for a newly published album', () => {
    const NEW = Array.from({ length: 13 }, (_, i) => ({ id: `fresh-${i}` }));

    beforeEach(async () => {
      await isPublishedAsset('a1'); // built, and checked a moment ago
    });

    afterEach(() => {
      state.albums['album-pub'].assets = [{ id: 'a1' }, { id: 'a2' }];
    });

    it('serves every photo when the save changed a content file', async () => {
      state.albums['album-pub'].assets = [{ id: 'a1' }, { id: 'a2' }, ...NEW];
      state.mtime += 1; // gallery.yaml saved by the admin
      const answers = await Promise.all(NEW.map((a) => isPublishedAsset(a.id)));
      expect(answers).toEqual(NEW.map(() => true));
    });

    it('serves every photo when only Immich changed (misses share one rebuild)', async () => {
      state.albums['album-pub'].assets = [{ id: 'a1' }, { id: 'a2' }, ...NEW];
      const before = state.builds;
      const answers = await Promise.all(NEW.map((a) => isPublishedAsset(a.id)));
      expect(answers).toEqual(NEW.map(() => true));
      expect(state.builds - before).toBe(1);
    });

    it('still refuses what the rebuild did not publish', async () => {
      const answers = await Promise.all(NEW.map((a) => isPublishedAsset(a.id)));
      expect(answers).toEqual(NEW.map(() => false));
    });
  });

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
