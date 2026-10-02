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
  const config = (zoom: boolean, albumZoom: Record<string, boolean> = {}) => ({ zoom, albumZoom });

  it('follows the site setting when nothing more specific is set', () => {
    expect(resolveZoom(config(false), A)).toBe(false);
    expect(resolveZoom(config(true), A)).toBe(true);
    expect(resolveZoom(config(true), A, {})).toBe(true);
  });

  it('lets a subpage override the site, both ways', () => {
    expect(resolveZoom(config(false), A, { zoom: true })).toBe(true);
    expect(resolveZoom(config(true), A, { zoom: false })).toBe(false);
  });

  it('lets an album override its subpage and the site, both ways', () => {
    expect(resolveZoom(config(false, { [A]: true }), A, { zoom: false })).toBe(true);
    expect(resolveZoom(config(true, { [A]: false }), A, { zoom: true })).toBe(false);
    // Only that album.
    expect(resolveZoom(config(true, { [A]: false }), B, { zoom: true })).toBe(true);
  });
});

describe('deriveGallery reads zoom', () => {
  it('keeps an album’s zoom in either direction, and only booleans', () => {
    const derived = deriveGallery({
      albums: [{ [A]: { zoom: true } }, { [B]: { zoom: false } }],
    } as GalleryYaml);
    expect(derived.albumZoom).toEqual({ [A]: true, [B]: false });

    const odd = deriveGallery({
      albums: [{ [A]: { zoom: 'yes' } }],
    } as unknown as GalleryYaml);
    expect(odd.albumZoom).toEqual({});
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
      subpages: { Travel: { albums: [A], zoom: true } },
    } as unknown as GalleryYaml);
    expect(record.subpages[0].zoom).toBe(true);
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

  it('carries the album overrides into the config', () => {
    withSettings({ zoom: true });
    expect(getConfig().albumZoom).toEqual({ [A]: false });
  });
});
