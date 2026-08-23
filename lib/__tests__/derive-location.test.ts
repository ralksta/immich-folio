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

describe('deriveGallery — location precision (#469)', () => {
  it('leaves an album without a setting absent, meaning exact', () => {
    const gallery: GalleryYaml = { albums: [A] };
    expect(deriveGallery(gallery).albumLocationPrecision[A]).toBeUndefined();
  });

  it('reads a per-album setting', () => {
    const gallery: GalleryYaml = { albums: [{ [A]: { location: 'city' } }] };
    expect(deriveGallery(gallery).albumLocationPrecision[A]).toBe('city');
  });

  it('applies a subpage setting to every album on it', () => {
    const gallery: GalleryYaml = {
      subpages: [{ name: 'Gardens', location: 'country', albums: [A, B] }],
    };
    const derived = deriveGallery(gallery);
    expect(derived.albumLocationPrecision[A]).toBe('country');
    expect(derived.albumLocationPrecision[B]).toBe('country');
  });

  it("lets an album state its own, overriding the subpage's", () => {
    const gallery: GalleryYaml = {
      subpages: [
        { name: 'Gardens', location: 'city', albums: [A, { [B]: { location: 'hidden' } }] },
      ],
    };
    const derived = deriveGallery(gallery);
    expect(derived.albumLocationPrecision[A]).toBe('city');
    expect(derived.albumLocationPrecision[B]).toBe('hidden');
  });

  /**
   * A typo in a privacy setting must not fall back to `exact` — that would
   * publish the position it was meant to withhold.
   */
  it('throws on an unknown album value rather than defaulting', () => {
    const gallery: GalleryYaml = { albums: [{ [A]: { location: 'приблизительно' } }] };
    expect(() => deriveGallery(gallery)).toThrow(/unknown location/i);
  });

  it('throws on an unknown subpage value', () => {
    const gallery: GalleryYaml = {
      subpages: [{ name: 'Gardens', location: 'vague', albums: [A] }],
    };
    expect(() => deriveGallery(gallery)).toThrow(/unknown location/i);
  });

  it('names the valid values in the error, so the log line is enough to fix it', () => {
    const gallery: GalleryYaml = { albums: [{ [A]: { location: 'nope' } }] };
    expect(() => deriveGallery(gallery)).toThrow(/exact.*city.*country.*hidden/);
  });
});
