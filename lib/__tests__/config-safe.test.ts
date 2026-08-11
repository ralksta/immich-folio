import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { getConfig, getConfigOrNull, invalidateConfigCache } from '@/lib/config';
import { loadYaml } from '@/lib/config/parser';

const ALBUM_ID = '11111111-1111-1111-1111-111111111111';

function withGallery(gallery: unknown) {
  vi.mocked(loadYaml).mockImplementation((filename: string) => {
    if (filename === 'gallery.yaml') return gallery;
    if (filename === 'settings.yaml') return {};
    return null;
  });
}

/**
 * The admin page builder can write each of these, and the root layout renders
 * /admin inside itself — so a throw here would take down the site together with
 * the only tool that can undo the save. An empty gallery is deliberately NOT in
 * this list: the install wizard can finish without selecting an album, so an
 * empty gallery is now a valid, rendered state (see derive-gallery.test.ts).
 */
const UNDERIVABLE = {
  'a subpage with no name': { albums: [ALBUM_ID], subpages: [{ albums: [ALBUM_ID] }] },
  'a subpage with neither albums nor sections': {
    albums: [ALBUM_ID],
    subpages: [{ name: 'Empty', albums: [] }],
  },
};

describe('getConfig() rejects an underivable gallery.yaml', () => {
  beforeEach(() => invalidateConfigCache());

  // Pins the premise the fix exists for. If these ever stop throwing, the
  // fallback below is dead weight and should be revisited rather than kept.
  for (const [label, gallery] of Object.entries(UNDERIVABLE)) {
    it(`throws on ${label}`, () => {
      withGallery(gallery);
      expect(() => getConfig()).toThrow();
    });
  }

  it('accepts an empty gallery — a valid post-install state', () => {
    // The install wizard may finish without selecting an album, so an empty
    // gallery must render (title-only homepage) rather than take down the site.
    withGallery({ albums: [] });
    const config = getConfig();
    expect(config.albums).toEqual([]);
    expect(config.standaloneAlbums).toEqual([]);
    expect(config.subpages).toEqual([]);
    expect(config.needsSetup).toBe(false);
  });
});

describe('getConfigOrNull()', () => {
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    invalidateConfigCache();
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => error.mockRestore());

  for (const [label, gallery] of Object.entries(UNDERIVABLE)) {
    it(`returns null instead of throwing on ${label}`, () => {
      withGallery(gallery);
      expect(getConfigOrNull()).toBeNull();
    });
  }

  it('logs the underlying error so the cause is diagnosable from the server log', () => {
    // A nameless subpage is still underivable — an empty gallery is not (the
    // install wizard can finish without an album, so that shape is now valid).
    withGallery({ albums: [ALBUM_ID], subpages: [{ albums: [ALBUM_ID] }] });
    getConfigOrNull();

    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0][0])).toMatch(/gallery\.yaml/);
  });

  it('points at the backup directory, since that is the recovery path', () => {
    withGallery({ albums: [ALBUM_ID], subpages: [{ albums: [ALBUM_ID] }] });
    getConfigOrNull();
    expect(String(error.mock.calls[0][0])).toContain('content/.backups/');
  });

  it('returns the real config untouched when the gallery is valid', () => {
    withGallery({ albums: [ALBUM_ID] });

    const config = getConfigOrNull();
    expect(config).not.toBeNull();
    expect(config?.albums).toEqual([ALBUM_ID]);
    expect(error).not.toHaveBeenCalled();
  });

  it('does not swallow the needsSetup path, which is a different state', () => {
    // Missing gallery.yaml is not an error — getConfig() returns a dummy config
    // with needsSetup so the app can render SetupScreen. That must still work.
    vi.mocked(loadYaml).mockReturnValue(null);

    const config = getConfigOrNull();
    expect(config).not.toBeNull();
    expect(config?.needsSetup).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });
});
