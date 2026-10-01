import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Two gaps in a subpage's `<head>`:
 *
 * - A `hidden: true` subpage is reachable by link only — off the nav, the
 *   home page and the sitemap — yet it and its albums inherited the layout's
 *   `index, follow`, so a crawler that found the link indexed it anyway.
 * - A subpage with more than one album had no description of its own and fell
 *   back to the site-wide one; an album page describes itself by its photo
 *   count.
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => false }));
vi.mock('@/lib/i18n/server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getServerDictionary: () => getDictionary('en') };
});
vi.mock('@/lib/ogImage', () => ({ ogImageUrl: () => '/api/og?sig=x' }));
vi.mock('../contentPage', () => ({
  contentPageAccess: vi.fn(async () => null),
  contentPageMetadata: vi.fn(async () => null),
  renderContentPage: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({
  isProtected: () => false,
  isAuthenticated: () => false,
  withoutLockedAlbums: <T>(albums: T[]) => albums,
}));

const config = vi.hoisted(() => ({
  subpages: [] as { slug: string; hidden?: boolean }[],
  seo: { noFollow: false },
}));
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return { ...actual, getConfig: () => config };
});

const album = (id: string, name: string) => ({
  id,
  albumName: name,
  slug: name.toLowerCase(),
  assets: [{ id: `${id}-a`, type: 'IMAGE' }],
  albumThumbnailAssetId: null,
});
const ICELAND = album('album-1', 'Iceland');
const NORWAY = album('album-2', 'Norway');

const subpages: Record<string, { subtitle?: string; albums: ReturnType<typeof album>[] }> = {
  travel: { albums: [ICELAND, NORWAY] },
  trips: { subtitle: 'Where the road went', albums: [ICELAND, NORWAY] },
  private: { albums: [ICELAND, NORWAY] },
  handover: { albums: [ICELAND] },
};

const immich = vi.hoisted(() => ({
  isSubpageSlug: vi.fn(),
  getSubpageAlbums: vi.fn(),
  getAlbumBySlug: vi.fn(),
}));
vi.mock('@/lib/immich', () => ({ immich }));

import { generateMetadata } from '../page';

const meta = (path: string[]) =>
  generateMetadata({ params: Promise.resolve({ path }), searchParams: Promise.resolve({}) });

beforeEach(() => {
  config.subpages = [
    { slug: 'travel' },
    { slug: 'trips' },
    { slug: 'private', hidden: true },
    { slug: 'handover', hidden: true },
  ];
  config.seo.noFollow = false;
  immich.isSubpageSlug.mockImplementation((slug: string) => slug in subpages);
  immich.getSubpageAlbums.mockImplementation(async (slug: string) => {
    const sp = subpages[slug];
    return sp ? { subpage: { slug, name: slug, subtitle: sp.subtitle }, albums: sp.albums } : null;
  });
  immich.getAlbumBySlug.mockImplementation(
    async (slug: string) => [ICELAND, NORWAY].find((a) => a.slug === slug) ?? null,
  );
});

describe('hidden subpages stay out of search results', () => {
  it.each([
    ['a hidden multi-album subpage', ['private']],
    ['a hidden single-album subpage', ['handover']],
    ['an album below a hidden subpage', ['private', 'iceland']],
  ])('marks %s noindex', async (_, path) => {
    const m = await meta(path);
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it('keeps the site-wide nofollow on a hidden subpage', async () => {
    config.seo.noFollow = true;
    expect((await meta(['private'])).robots).toEqual({ index: false, follow: false });
  });

  it('leaves a visible subpage, its albums and standalone albums to the layout', async () => {
    expect((await meta(['travel'])).robots).toBeUndefined();
    expect((await meta(['travel', 'iceland'])).robots).toBeUndefined();
    expect((await meta(['iceland'])).robots).toBeUndefined();
  });
});

describe('multi-album subpage description', () => {
  it('describes the subpage by its album count when it has no subtitle', async () => {
    const m = await meta(['travel']);
    expect(m.description).toBe('travel — 2 albums');
    expect(m.openGraph?.description).toBe('travel — 2 albums');
  });

  it('prefers the subtitle when there is one', async () => {
    const m = await meta(['trips']);
    expect(m.description).toBe('Where the road went');
  });
});
