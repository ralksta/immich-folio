import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense, isValidElement, type ReactElement } from 'react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Next sends the status with the first byte, and the first byte goes out as
 * soon as a Suspense fallback renders. The catch-all used to sit inside
 * loading.tsx boundaries (app/ and app/[...path]/), so its skeleton streamed
 * as a 200 before the page could call notFound(): `/nope`, an offline subpage,
 * a draft content page and `/<subpage>/<unknown>` were all soft 404s — the
 * not-found page with a 200.
 *
 * The page now decides whether the path exists before it renders a boundary,
 * and only then streams the skeleton around the part that fetches photos.
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

const admin = vi.hoisted(() => ({ signedIn: false }));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => admin.signedIn }));
vi.mock('@/lib/i18n/server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getServerDictionary: () => getDictionary('en') };
});

const locked = vi.hoisted(() => ({ keys: new Set<string>() }));
vi.mock('@/lib/auth', () => ({
  isProtected: (key: string) => locked.keys.has(key),
  isAuthenticated: () => false,
  withoutLockedAlbums: <T>(albums: T[]) => albums,
}));

const pages = vi.hoisted(() => ({
  access: new Map<string, 'open' | 'draft' | 'locked'>(),
}));
vi.mock('../contentPage', () => ({
  contentPageAccess: vi.fn(async (slug: string) => pages.access.get(slug) ?? null),
  contentPageMetadata: vi.fn(async () => null),
  renderContentPage: vi.fn(async () => null),
}));

const ICELAND = {
  id: 'album-1',
  albumName: 'Iceland',
  slug: 'iceland',
  assets: [],
  albumThumbnailAssetId: null,
};

const immich = vi.hoisted(() => ({
  isSubpageSlug: vi.fn(),
  getSubpageAlbums: vi.fn(),
  findAlbumBySlug: vi.fn(),
  getAlbumBySlug: vi.fn(),
  getStandaloneAlbums: vi.fn(async () => []),
  getSubpages: vi.fn(async () => []),
  getAssetInfo: vi.fn(async () => null),
}));
vi.mock('@/lib/immich', () => ({ immich }));

import PathPage from '../page';
import { PathSkeleton } from '../PathSkeleton';

const call = (segments: string[]) => ({
  params: Promise.resolve({ path: segments }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  vi.clearAllMocks();
  admin.signedIn = false;
  locked.keys.clear();
  pages.access = new Map([
    ['about-us', 'open'],
    ['pricing', 'draft'],
    ['members', 'locked'],
  ]);
  // `dubai` is `enabled: false`: isSubpageSlug() and every lookup skip it.
  immich.isSubpageSlug.mockImplementation((slug: string) =>
    ['travel', 'vault', 'empty'].includes(slug),
  );
  immich.getSubpageAlbums.mockImplementation(async (slug: string) => {
    if (slug === 'empty') return { subpage: { slug, name: 'Empty', albumIds: [] }, albums: [] };
    if (slug === 'travel' || slug === 'vault') {
      return { subpage: { slug, name: slug, albumIds: ['album-1'] }, albums: [ICELAND] };
    }
    return null;
  });
  immich.findAlbumBySlug.mockImplementation(async (slug: string, subpage?: string) =>
    slug === 'iceland' && (subpage === undefined || subpage === 'travel' || subpage === 'vault')
      ? ICELAND
      : null,
  );
  immich.getAlbumBySlug.mockResolvedValue(ICELAND);
});

describe('catch-all not-found status', () => {
  it.each([
    ['an unknown slug', ['nope']],
    ['a long made-up slug', ['this-is-a-long-made-up-slug-that-names-nothing-at-all-0123456789']],
    ['a disabled subpage', ['dubai']],
    ['a draft content page', ['pricing']],
    ['a subpage without published albums', ['empty']],
    ['an unknown album under a real subpage', ['travel', 'nope']],
    ['an album under a disabled subpage', ['dubai', 'iceland']],
    ['a three-segment path', ['x', 'y', 'z']],
  ])('calls notFound() for %s before anything can stream', async (_, segments) => {
    await expect(PathPage(call(segments))).rejects.toBe(NOT_FOUND);
    // No photo was fetched: the decision came from the album list alone.
    expect(immich.getAlbumBySlug).not.toHaveBeenCalled();
  });

  it.each([
    ['a subpage', ['travel']],
    ['an album under a subpage', ['travel', 'iceland']],
    ['a standalone album', ['iceland']],
    ['a content page', ['about-us']],
    ['a locked content page (its gate renders)', ['members']],
  ])('streams %s behind the skeleton, deciding first', async (_, segments) => {
    const element = (await PathPage(call(segments))) as ReactElement<{ fallback: ReactElement }>;

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(Suspense);
    expect(element.props.fallback.type).toBe(PathSkeleton);
    // The asset fetch — the slow part — happens inside the boundary.
    expect(immich.getAlbumBySlug).not.toHaveBeenCalled();
  });

  it('does not tell a visitor without the password which albums a locked subpage holds', async () => {
    locked.keys.add('vault');

    const known = await PathPage(call(['vault', 'iceland']));
    const unknown = await PathPage(call(['vault', 'no-such-album']));

    expect((known as ReactElement).type).toBe(Suspense);
    expect((unknown as ReactElement).type).toBe(Suspense);
    expect(immich.findAlbumBySlug).not.toHaveBeenCalled();
  });

  it('lets a locked subpage show its gate even before its albums are known', async () => {
    locked.keys.add('empty');
    const element = await PathPage(call(['empty']));
    expect((element as ReactElement).type).toBe(Suspense);
  });

  it('leaves a signed-in admin the diagnostic banner instead of the 404', async () => {
    admin.signedIn = true;
    const element = await PathPage(call(['nope']));
    expect((element as ReactElement).type).toBe(Suspense);
    // ...but never for a path deeper than the catch-all serves.
    await expect(PathPage(call(['x', 'y', 'z']))).rejects.toBe(NOT_FOUND);
  });

  it('surfaces an Immich outage as an error, never as a missing album', async () => {
    const outage = new Error('Immich unavailable');
    immich.findAlbumBySlug.mockRejectedValue(outage);

    await expect(PathPage(call(['iceland']))).rejects.toBe(outage);
    await expect(PathPage(call(['travel', 'iceland']))).rejects.toBe(outage);
  });

  it('has no loading.tsx above it, which would stream the 200 first', () => {
    // A loading file wraps every route below its folder in a Suspense
    // boundary, and nothing the page does inside one can change the status.
    const appDir = path.join(process.cwd(), 'app');
    for (const dir of [appDir, path.join(appDir, '[...path]')]) {
      const loading = fs.readdirSync(dir).filter((name) => /^loading\.(t|j)sx?$/.test(name));
      expect(loading, dir).toEqual([]);
    }
  });
});
