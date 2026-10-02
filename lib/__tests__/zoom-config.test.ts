import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    RATE_LIMIT_RPM: 120,
  },
  normalizeApiUrl: (raw: string) => raw.replace(/\/+$/, ''),
}));

vi.mock('@/lib/secret', () => ({
  resolveAuthSecret: () => 'test-auth-secret-32-chars-long-min',
}));

vi.mock('@/lib/config/parser', () => ({
  loadYaml: vi.fn(),
  clearYamlCache: vi.fn(),
  validateUuid: (id: string) => id,
}));

import { deriveGallery, getConfig, invalidateConfigCache, resolveZoom } from '@/lib/config';
import { loadYaml } from '@/lib/config/parser';
import type { GalleryYaml } from '@/lib/config/schema';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

/**
 * Lightbox zoom (#467): a site-wide switch in settings.yaml, off by default,
 * overridden by a subpage and then by an album, each in either direction.
 */
describe('resolveZoom', () => {
  const config = (zoom: boolean, standaloneAlbumZoom: Record<string, boolean> = {}) => ({
    zoom,
    standaloneAlbumZoom,
  });

  it('follows the site setting when nothing more specific is set', () => {
    expect(resolveZoom(config(false), A)).toBe(false);
    expect(resolveZoom(config(true), A)).toBe(true);
    expect(resolveZoom(config(true), A, {})).toBe(true);
  });

  it('lets a subpage override the site, both ways', () => {
    expect(resolveZoom(config(false), A, { zoom: true })).toBe(true);
    expect(resolveZoom(config(true), A, { zoom: false })).toBe(false);
  });

  it('lets an album entry override its subpage and the site, both ways', () => {
    expect(resolveZoom(config(false), A, { zoom: false, albumZoom: { [A]: true } })).toBe(true);
    expect(resolveZoom(config(true), A, { zoom: true, albumZoom: { [A]: false } })).toBe(false);
    // Only that album.
    expect(resolveZoom(config(true), B, { zoom: true, albumZoom: { [A]: false } })).toBe(true);
  });

  it('reads the standalone override only for the standalone route', () => {
    const c = config(true, { [A]: false });
    expect(resolveZoom(c, A)).toBe(false);
    // On a subpage the standalone entry has no say.
    expect(resolveZoom(c, A, {})).toBe(true);
  });
});

describe('deriveGallery keeps album zoom per route (review of #830)', () => {
  /*
   * The reported leak: one album on an open page with zoom off and on a
   * password page with zoom on. A single map let the last entry decide for
   * both, so the open page served zoom its owner had switched off.
   */
  const pages = (first: boolean) => {
    const open = { name: 'Public', albums: [{ [A]: { zoom: false } }] };
    const locked = { name: 'Client', password: 'pw', albums: [{ [A]: { zoom: true } }] };
    return deriveGallery({ subpages: first ? [open, locked] : [locked, open] } as GalleryYaml);
  };

  it.each([true, false])('keeps each page’s own value (open page first: %s)', (openFirst) => {
    const derived = pages(openFirst);
    const open = derived.subpages.find((sp) => sp.slug === 'public')!;
    const locked = derived.subpages.find((sp) => sp.slug === 'client')!;
    const cfg = { zoom: false, standaloneAlbumZoom: derived.standaloneAlbumZoom };
    expect(resolveZoom(cfg, A, open)).toBe(false);
    expect(resolveZoom(cfg, A, locked)).toBe(true);
  });

  it('keeps a standalone entry apart from a subpage entry for the same album', () => {
    const derived = deriveGallery({
      albums: [{ [A]: { zoom: true } }],
      subpages: [{ name: 'S', albums: [{ [A]: { zoom: false } }] }],
    } as GalleryYaml);
    expect(derived.standaloneAlbumZoom).toEqual({ [A]: true });
    expect(derived.subpages[0].albumZoom).toEqual({ [A]: false });
  });

  it('collects section entries on their subpage, and false wins within one page', () => {
    const derived = deriveGallery({
      subpages: [
        {
          name: 'S',
          albums: [{ [B]: { zoom: true } }],
          sections: [
            { title: 'One', albums: [{ [A]: { zoom: true } }] },
            { title: 'Two', albums: [{ [A]: { zoom: false } }] },
          ],
        },
        { name: 'T', albums: [A] },
      ],
    } as GalleryYaml);
    expect(derived.subpages[0].albumZoom).toEqual({ [A]: false, [B]: true });
    expect(derived.subpages[1].albumZoom).toBeUndefined();
  });

  it('ignores anything but a boolean', () => {
    const odd = deriveGallery({ albums: [{ [A]: { zoom: 'yes' } }] } as unknown as GalleryYaml);
    expect(odd.standaloneAlbumZoom).toEqual({});
  });

  it('keeps a subpage’s zoom in both gallery.yaml shapes', () => {
    const list = deriveGallery({
      subpages: [
        { name: 'On', albums: [A], zoom: true },
        { name: 'Off', albums: [B], zoom: false },
        { name: 'Unset', albums: [A] },
      ],
    } as GalleryYaml);
    expect(list.subpages.map((sp) => sp.zoom)).toEqual([true, false, undefined]);

    const record = deriveGallery({
      subpages: { Travel: { albums: [{ [A]: { zoom: false } }], zoom: true } },
    } as unknown as GalleryYaml);
    expect(record.subpages[0].zoom).toBe(true);
    expect(record.subpages[0].albumZoom).toEqual({ [A]: false });
  });
});

describe('the site setting', () => {
  beforeEach(() => invalidateConfigCache());

  const withSettings = (settings: Record<string, unknown>) =>
    vi.mocked(loadYaml).mockImplementation((filename: string) => {
      if (filename === 'gallery.yaml') return { albums: [{ [A]: { zoom: false } }] };
      if (filename === 'settings.yaml') return settings;
      return null;
    });

  it('is off unless settings.yaml says true', () => {
    withSettings({});
    expect(getConfig().zoom).toBe(false);
    invalidateConfigCache();
    withSettings({ zoom: 'true' });
    expect(getConfig().zoom).toBe(false);
    invalidateConfigCache();
    withSettings({ zoom: true });
    expect(getConfig().zoom).toBe(true);
  });

  it('carries the standalone album overrides into the config', () => {
    withSettings({ zoom: true });
    expect(getConfig().standaloneAlbumZoom).toEqual({ [A]: false });
  });
});
