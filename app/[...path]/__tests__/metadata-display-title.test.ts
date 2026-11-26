import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A single-album subpage shows its Display Title as the heading, so the
 * browser tab and link previews carry the same title (#921).
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => false }));
vi.mock('@/lib/i18n/server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getServerDictionary: () => getDictionary('en') };
});
vi.mock('@/lib/ogImage', () => ({
  ogImageUrl: (title: string) => `/api/og?title=${encodeURIComponent(title)}`,
}));
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
  hiddenAlbums: [] as string[],
  seo: { noFollow: false },
}));
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return { ...actual, getConfig: () => config };
});

const ICELAND = {
  id: 'album-1',
  albumName: 'Iceland',
  slug: 'iceland',
  assets: [{ id: 'a1', type: 'IMAGE' }],
  albumThumbnailAssetId: null,
};

const subpageTitle = vi.hoisted(() => ({ value: undefined as string | undefined }));
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
  config.subpages = [{ slug: 'trip' }];
  config.hiddenAlbums = [];
  config.seo.noFollow = false;
  immich.isSubpageSlug.mockImplementation((slug: string) => slug === 'trip');
  immich.getSubpageAlbums.mockImplementation(async (slug: string) => ({
    subpage: { slug, name: 'trip', title: subpageTitle.value },
    albums: [ICELAND],
  }));
  immich.getAlbumBySlug.mockImplementation(async () => ICELAND);
});

describe('single-album subpage metadata uses the Display Title', () => {
  it('sets title, og, twitter and the share card from it, trimmed', async () => {
    subpageTitle.value = '  Land of Fire  ';
    const m = await meta(['trip']);
    expect(m.title).toBe('Land of Fire');
    expect(m.openGraph?.title).toBe('Land of Fire');
    expect(m.twitter?.title).toBe('Land of Fire');
    expect(m.openGraph?.description).toContain('Land of Fire');
    expect(m.openGraph?.images).toEqual(['/api/og?title=Land%20of%20Fire']);
  });

  it.each([undefined, '', '   '])('falls back to the album name for %j', async (title) => {
    subpageTitle.value = title;
    const m = await meta(['trip']);
    expect(m.title).toBe('Iceland');
    expect(m.openGraph?.title).toBe('Iceland');
    expect(m.twitter?.title).toBe('Iceland');
  });

  it('leaves a standalone album page on the album name', async () => {
    subpageTitle.value = 'Land of Fire';
    expect((await meta(['iceland'])).title).toBe('Iceland');
  });
});
