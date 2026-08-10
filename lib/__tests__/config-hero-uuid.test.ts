import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Spy on validateUuid so we can assert *which* values are routed through it.
// vi.hoisted because vi.mock factories are hoisted above const declarations.
// Two-arg signature, matching the real validateUuid(id, context) — the context
// argument is what the second assertion below inspects.
const { validateUuidSpy } = vi.hoisted(() => ({
  validateUuidSpy: vi.fn((id: string, _context: string) => id),
}));

vi.mock('@/lib/config/parser', () => ({
  loadYaml: vi.fn(),
  clearYamlCache: vi.fn(),
  validateUuid: validateUuidSpy,
}));

import { getConfig, invalidateConfigCache } from '@/lib/config';
import { loadYaml } from '@/lib/config/parser';

const ALBUM_ID = '11111111-1111-1111-1111-111111111111';
const HERO_ID = '22222222-2222-2222-2222-222222222222';

/**
 * Every asset ID in gallery.yaml is routed through validateUuid before it can
 * reach encodeAssetId, which encrypts whatever it is handed. A per-album
 * heroImage was the one that slipped through: the album ID (the map key) was
 * validated, the hero asset ID (the value) was stored raw. A typo there
 * produced a perfectly well-formed image URL that 404s forever, with nothing in
 * the log naming the cause.
 */
describe('gallery.yaml per-album heroImage', () => {
  beforeEach(() => {
    validateUuidSpy.mockClear();
    invalidateConfigCache();
    vi.mocked(loadYaml).mockImplementation((filename: string) => {
      if (filename === 'gallery.yaml') {
        return { albums: [{ [ALBUM_ID]: { title: 'An Album', heroImage: HERO_ID } }] };
      }
      if (filename === 'settings.yaml') return {};
      return null;
    });
  });

  it('routes the hero asset ID through validateUuid, not just the album ID', () => {
    getConfig();

    const validated = validateUuidSpy.mock.calls.map((c) => c[0]);
    expect(validated).toContain(HERO_ID);
  });

  it('names the album in the validation context so the warning is actionable', () => {
    getConfig();

    const heroCall = validateUuidSpy.mock.calls.find((c) => c[0] === HERO_ID);
    expect(heroCall?.[1]).toContain(ALBUM_ID);
  });

  it('stores the validated value, keyed by album', () => {
    expect(getConfig().albumHeroImages[ALBUM_ID]).toBe(HERO_ID);
  });

  // Same class of ID, same requirement: a pinned asset ID from `sort: manual`
  // is written by the admin panel and can be hand-edited, so it goes through
  // the same gate. A substituted zero UUID simply never matches an asset in the
  // album, so the pin is ignored rather than corrupting the order.
  it('routes manual assetOrder IDs through validateUuid, naming the album', () => {
    vi.mocked(loadYaml).mockImplementation((filename: string) => {
      if (filename === 'gallery.yaml') {
        return { albums: [{ [ALBUM_ID]: { sort: 'manual', assetOrder: [HERO_ID] } }] };
      }
      if (filename === 'settings.yaml') return {};
      return null;
    });
    invalidateConfigCache();

    const config = getConfig();

    expect(config.albumManualOrders[ALBUM_ID]).toEqual([HERO_ID]);
    const call = validateUuidSpy.mock.calls.find((c) => c[0] === HERO_ID);
    expect(call?.[1]).toContain(ALBUM_ID);
  });

  // The substitution the wiring above depends on: validateUuid never throws, so
  // a bad ID degrades to a 404 image rather than taking the whole page down.
  it('real validateUuid warns and substitutes rather than throwing', async () => {
    const actual =
      await vi.importActual<typeof import('@/lib/config/parser')>('@/lib/config/parser');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = actual.validateUuid('not-a-uuid', 'gallery.yaml heroImage');

    expect(result).toBe('00000000-0000-0000-0000-000000000000');
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain('gallery.yaml heroImage');
    warn.mockRestore();
  });
});
