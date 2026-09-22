import { describe, it, expect, vi, afterEach } from 'vitest';

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

vi.mock('@/lib/secret', () => ({
  resolveAuthSecret: () => 'test-auth-secret-32-chars-long-min',
}));

vi.mock('@/lib/config/parser', () => ({
  loadYaml: vi.fn(),
  clearYamlCache: vi.fn(),
  validateUuid: (id: string) => id,
}));

import { getConfig, invalidateConfigCache, deriveGallery } from '@/lib/config';
import { loadYaml } from '@/lib/config/parser';
import type { GalleryYaml } from '@/lib/config/schema';

const ALBUM_ID = '11111111-1111-1111-1111-111111111111';

function withSettings(settings: unknown) {
  vi.mocked(loadYaml).mockImplementation((filename: string) => {
    if (filename === 'gallery.yaml') return { albums: [ALBUM_ID] };
    if (filename === 'settings.yaml') return settings;
    return null;
  });
}

afterEach(() => {
  invalidateConfigCache();
  vi.clearAllMocks();
});

/**
 * `--grid-columns` is emitted unclamped in app/[...path]/page.tsx, so a bad
 * `columns` reaches `repeat()` invalid and collapses the whole grid to one
 * column with no error anywhere (#633). The cover grid already clamped
 * (buildCoverGridVars); the site-wide photo grid did not.
 */
describe('site-wide grid.columns / grid.gap clamping (#633)', () => {
  it('clamps a negative columns count to the minimum', () => {
    withSettings({ grid: { columns: -1 } });
    expect(getConfig().grid.columns).toBe(1);
  });

  it('clamps an out-of-range columns count to the maximum', () => {
    withSettings({ grid: { columns: 99 } });
    expect(getConfig().grid.columns).toBe(6);
  });

  it('falls back to the default when columns is not a number', () => {
    withSettings({ grid: { columns: 'three' as unknown as number } });
    expect(getConfig().grid.columns).toBe(1); // clamp()'s min, not silently NaN
  });

  it('keeps a legitimate columns value', () => {
    withSettings({ grid: { columns: 4 } });
    expect(getConfig().grid.columns).toBe(4);
  });

  it('defaults columns to 3 when unset', () => {
    withSettings({});
    expect(getConfig().grid.columns).toBe(3);
  });

  it('clamps gap the same way', () => {
    withSettings({ grid: { gap: -5 } });
    expect(getConfig().grid.gap).toBe(0);
    withSettings({ grid: { gap: 9999 } });
    invalidateConfigCache();
    expect(getConfig().grid.gap).toBe(48);
  });
});

/**
 * Same guard for a subpage's or an album's own grid override — the merged
 * value (site-wide default overridden by this) is what actually reaches
 * `--grid-columns`.
 */
describe('per-subpage grid override clamping (#633)', () => {
  it('clamps a negative subpage columns override', () => {
    const gallery = {
      subpages: [{ name: 'Trips', albums: [ALBUM_ID], grid: { columns: -1 } }],
    } as unknown as GalleryYaml;
    const derived = deriveGallery(gallery);
    expect(derived.subpages[0].grid?.columns).toBe(1);
  });

  it('clamps an out-of-range subpage columns override', () => {
    const gallery = {
      subpages: [{ name: 'Trips', albums: [ALBUM_ID], grid: { columns: 40 } }],
    } as unknown as GalleryYaml;
    const derived = deriveGallery(gallery);
    expect(derived.subpages[0].grid?.columns).toBe(6);
  });

  it('keeps a legitimate subpage columns override', () => {
    const gallery = {
      subpages: [{ name: 'Trips', albums: [ALBUM_ID], grid: { columns: 2 } }],
    } as unknown as GalleryYaml;
    const derived = deriveGallery(gallery);
    expect(derived.subpages[0].grid?.columns).toBe(2);
  });
});
