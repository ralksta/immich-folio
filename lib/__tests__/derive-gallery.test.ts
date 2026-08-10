import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test Gallery',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    IMMICH_TIMEOUT_MS: 15000,
    RATE_LIMIT_RPM: 120,
    TRUSTED_PROXY_HOPS: 0,
  },
}));

vi.mock('@/lib/config/parser', () => ({
  loadYaml: vi.fn(),
  clearYamlCache: vi.fn(),
  validateUuid: (id: string) => id,
}));

import { deriveGallery } from '@/lib/config';
import type { GalleryYaml } from '@/lib/config/schema';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

/**
 * The admin PUT calls this before writing, so that a save the site cannot load
 * is rejected with a 400 instead of reported as successful. These are the exact
 * shapes the page builder can produce.
 */
describe('deriveGallery rejects what the site cannot load', () => {
  it('rejects a gallery with neither albums nor subpages', () => {
    expect(() => deriveGallery({ albums: [] } as GalleryYaml)).toThrow(/at least one album/i);
  });

  it('rejects a subpage with no name', () => {
    expect(() =>
      deriveGallery({ albums: [A], subpages: [{ albums: [A] }] } as unknown as GalleryYaml),
    ).toThrow(/must have a name/i);
  });

  it('rejects a subpage with neither albums nor sections', () => {
    expect(() =>
      deriveGallery({
        albums: [A],
        subpages: [{ name: 'Empty', albums: [] }],
      } as unknown as GalleryYaml),
    ).toThrow(/Empty/);
  });

  // The message reaches the admin UI as the 400 body, so it has to identify
  // which subpage is at fault — "invalid gallery" would be useless in a builder
  // with a dozen subpages.
  it('names the offending subpage so the error is actionable', () => {
    expect(() =>
      deriveGallery({
        albums: [A],
        subpages: [
          { name: 'Fine', albums: [A] },
          { name: 'Broken One', albums: [] },
        ],
      } as unknown as GalleryYaml),
    ).toThrow(/Broken One/);
  });
});

describe('deriveGallery accepts valid structures', () => {
  it('derives standalone albums', () => {
    const result = deriveGallery({ albums: [A, B] } as GalleryYaml);
    expect(result.albums).toEqual([A, B]);
    expect(result.standaloneAlbums).toEqual([A, B]);
    expect(result.subpages).toEqual([]);
  });

  it('treats an album inside a subpage as no longer standalone', () => {
    const result = deriveGallery({
      albums: [A],
      subpages: [{ name: 'Trips', albums: [B] }],
    } as unknown as GalleryYaml);

    expect(result.albums).toEqual([A, B]);
    expect(result.standaloneAlbums).toEqual([A]);
    expect(result.subpages[0].slug).toBe('trips');
  });

  it('accepts a subpage that has sections instead of albums', () => {
    const result = deriveGallery({
      subpages: [{ name: 'Work', sections: [{ title: 'Recent Work', albums: [A] }] }],
    } as unknown as GalleryYaml);

    expect(result.subpages[0].sections?.[0].slug).toBe('recent-work');
    expect(result.albums).toEqual([A]);
  });

  it('collects per-album overrides and hero images', () => {
    const result = deriveGallery({
      albums: [{ [A]: { title: 'Renamed', description: 'A note', heroImage: B } }],
    } as unknown as GalleryYaml);

    expect(result.albumOverrides[A]).toBe('Renamed');
    expect(result.albumDescriptions[A]).toBe('A note');
    expect(result.albumHeroImages[A]).toBe(B);
  });

  it('collects the per-album sort mode', () => {
    const result = deriveGallery({
      albums: [{ [A]: { title: 'Series', sort: 'filename' } }, B],
    } as unknown as GalleryYaml);

    expect(result.albumSortModes[A]).toBe('filename');
    // Absent means the default; an explicit entry would make `immich` and
    // "never configured" indistinguishable downstream.
    expect(result.albumSortModes[B]).toBeUndefined();
  });

  // A typo would otherwise be invisible: the album would keep rendering in
  // Immich order and nothing would say why. Throwing is also what gives the
  // admin PUT its 400, via the deriveGallery dry-run.
  it('rejects an unknown sort mode, naming the album and the valid values', () => {
    expect(() =>
      deriveGallery({ albums: [{ [A]: { sort: 'alphabetical' } }] } as unknown as GalleryYaml),
    ).toThrow(/alphabetical/);

    expect(() =>
      deriveGallery({ albums: [{ [A]: { sort: 'alphabetical' } }] } as unknown as GalleryYaml),
    ).toThrow(new RegExp(A));

    expect(() =>
      deriveGallery({ albums: [{ [A]: { sort: 'alphabetical' } }] } as unknown as GalleryYaml),
    ).toThrow(/filename/);
  });

  it('collects the manual asset order, preserving its order', () => {
    const result = deriveGallery({
      albums: [{ [A]: { sort: 'manual', assetOrder: [B, A] } }],
    } as unknown as GalleryYaml);

    expect(result.albumManualOrders[A]).toEqual([B, A]);
  });

  // Kept regardless of the mode, so toggling manual → newest → manual in the
  // admin panel does not silently destroy a hand-curated order.
  it('keeps the asset order even when the mode is not manual', () => {
    const result = deriveGallery({
      albums: [{ [A]: { sort: 'newest', assetOrder: [B] } }],
    } as unknown as GalleryYaml);

    expect(result.albumSortModes[A]).toBe('newest');
    expect(result.albumManualOrders[A]).toEqual([B]);
  });

  it('ignores an empty asset order rather than storing one', () => {
    const result = deriveGallery({
      albums: [{ [A]: { sort: 'manual', assetOrder: [] } }],
    } as unknown as GalleryYaml);

    expect(result.albumManualOrders[A]).toBeUndefined();
  });

  // processAlbumEntry is reached from four places; only the array-subpage path
  // was covered before, so a regression in the others would go unnoticed.
  it('applies the sort mode to section and map-style subpage albums too', () => {
    const sectioned = deriveGallery({
      subpages: [
        { name: 'Work', sections: [{ title: 'Recent', albums: [{ [A]: { sort: 'oldest' } }] }] },
      ],
    } as unknown as GalleryYaml);
    expect(sectioned.albumSortModes[A]).toBe('oldest');

    const mapStyle = deriveGallery({
      subpages: { Trips: { albums: [{ [B]: { sort: 'filename' } }] } },
    } as unknown as GalleryYaml);
    expect(mapStyle.albumSortModes[B]).toBe('filename');
  });

  it('parses enabled property on subpages correctly', () => {
    const result = deriveGallery({
      subpages: [
        { name: 'Active Page', albums: [A], enabled: true },
        { name: 'Disabled Page', albums: [B], enabled: false },
      ],
    } as unknown as GalleryYaml);

    expect(result.subpages[0].enabled).toBe(true);
    expect(result.subpages[1].enabled).toBe(false);
  });
});
