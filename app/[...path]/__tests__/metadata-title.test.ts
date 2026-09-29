import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Metadata } from 'next';

/**
 * generateMetadata runs for any URL a visitor types. It used to start from
 * `title = slug` and keep that whenever nothing matched, so an unknown path,
 * an offline subpage or a locked album put the requested slug in the
 * `<title>` and in a validly signed share-card URL. Every branch that finds
 * nothing — or finds it locked — now answers with a dictionary title and no
 * card of its own.
 */

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => false }));
vi.mock('@/lib/i18n/server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getServerDictionary: () => getDictionary('en') };
});
vi.mock('@/lib/ogImage', () => ({
  ogImageUrl: (title: string, subtitle = '') =>
    `/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}&sig=x`,
}));
vi.mock('../contentPage', () => ({
  contentPageMetadata: vi.fn(async () => null),
  renderContentPage: vi.fn(async () => null),
}));

const locked = vi.hoisted(() => ({ keys: new Set<string>() }));
vi.mock('@/lib/auth', () => ({
  isProtected: (key: string) => locked.keys.has(key),
  isAuthenticated: () => false,
  withoutLockedAlbums: <T>(albums: T[]) => albums,
}));

const immich = vi.hoisted(() => ({
  isSubpageSlug: vi.fn((slug: string) => slug === 'travel' || slug === 'solo'),
  getSubpageAlbums: vi.fn(),
  getAlbumBySlug: vi.fn(),
}));
vi.mock('@/lib/immich', () => ({ immich }));

const ICELAND = {
  id: 'album-1',
  albumName: 'Iceland',
  slug: 'iceland',
  assets: [{ id: 'a1', type: 'IMAGE' }],
  albumThumbnailAssetId: null,
};

import { generateMetadata } from '../page';
import { getDictionary } from '@/lib/i18n';

const en = getDictionary('en');

const meta = (path: string[]) =>
  generateMetadata({ params: Promise.resolve({ path }), searchParams: Promise.resolve({}) });

/** Every string the metadata would put in the page head or a share URL. */
function emitted(m: Metadata): string {
  return JSON.stringify(m);
}

beforeEach(() => {
  vi.clearAllMocks();
  locked.keys.clear();
  immich.getAlbumBySlug.mockImplementation(async (slug: string) =>
    slug === 'iceland' ? ICELAND : null,
  );
  immich.getSubpageAlbums.mockImplementation(async (slug: string) => {
    if (slug === 'travel') {
      return {
        subpage: { slug: 'travel', name: 'travel', title: 'Travel', albumIds: ['album-1', 'b'] },
        albums: [ICELAND, { ...ICELAND, id: 'b', slug: 'norway', albumName: 'Norway' }],
      };
    }
    if (slug === 'solo') {
      return { subpage: { slug: 'solo', name: 'solo', albumIds: ['album-1'] }, albums: [ICELAND] };
    }
    return null;
  });
});

describe('page metadata never echoes the requested path', () => {
  it.each([
    ['an unknown slug', ['unknown-visitor-text']],
    ['an unknown album under a real subpage', ['travel', 'nope']],
    ['a three-segment path', ['iceland', 'x', 'y']],
  ])('gives %s the generic not-found title and no card', async (_, path) => {
    const m = await meta(path);

    expect(m.title).toBe(en.error.notFoundTitle);
    expect(m.openGraph).toBeUndefined();
    expect(m.twitter).toBeUndefined();
    for (const segment of path) expect(emitted(m)).not.toContain(encodeURIComponent(segment));
  });

  it('drops the layout robots tag on a not-found path, leaving only Next’s noindex', async () => {
    const m = await meta(['nope']);
    expect(m.robots).toBeNull();
  });

  it('treats an offline subpage like any unknown slug', async () => {
    // isSubpageSlug is false for `enabled: false`, and no album has the slug.
    const m = await meta(['dubai']);
    expect(m.title).toBe(en.error.notFoundTitle);
    expect(emitted(m)).not.toContain('dubai');
  });

  it('gives a locked standalone album the generic protected title', async () => {
    locked.keys.add('album-1');
    const m = await meta(['iceland']);

    expect(m.title).toBe(en.password.protectedPage);
    expect(emitted(m)).not.toContain('iceland');
    expect(emitted(m)).not.toContain('Iceland');
    expect(m.openGraph).toBeUndefined();
  });

  it('gives a locked multi-album subpage the protected title, not its slug', async () => {
    locked.keys.add('travel');
    const m = await meta(['travel']);

    expect(m.title).toBe(en.password.protectedPage);
    expect(emitted(m)).not.toContain('travel');
  });

  it('gives an album under a locked subpage the protected title', async () => {
    locked.keys.add('travel');
    const m = await meta(['travel', 'iceland']);

    expect(m.title).toBe(en.password.protectedPage);
    expect(emitted(m)).not.toContain('Iceland');
  });

  it('gives a locked album on a single-album subpage the protected title', async () => {
    locked.keys.add('album-1');
    const m = await meta(['solo']);

    expect(m.title).toBe(en.password.protectedPage);
    expect(emitted(m)).not.toContain('solo');
  });

  it('still describes published content by its own name', async () => {
    const album = await meta(['iceland']);
    expect(album.title).toBe('Iceland');
    expect(emitted(album)).toContain(encodeURIComponent('Iceland'));

    const subpage = await meta(['travel']);
    expect(subpage.title).toBe('Travel');

    const nested = await meta(['travel', 'iceland']);
    expect(nested.title).toBe('Iceland');
  });
});
