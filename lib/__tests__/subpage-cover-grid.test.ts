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

function subpage(entry: Record<string, unknown>) {
  const gallery = deriveGallery({
    subpages: [{ name: 'Travel', albums: [A], ...entry }],
  } as unknown as GalleryYaml);
  return gallery.subpages[0];
}

/**
 * The album covers and the photos inside those albums used to share a single
 * `grid` key, so a gap typed into the admin's "Album Cover Grid" retuned every
 * photo grid on the page (#523).
 */
describe('subpage grid vs. coverGrid', () => {
  it('keeps the two independent once both are set', () => {
    const sp = subpage({ grid: { columns: 4, gap: 6 }, coverGrid: { columns: 2, gap: 24 } });
    expect(sp.grid).toEqual({ columns: 4, gap: 6 });
    expect(sp.coverGrid).toEqual({ columns: 2, gap: 24 });
  });

  it('leaves the photo grid alone when only the covers are configured', () => {
    const sp = subpage({ coverGrid: { columns: 2, gap: 24 } });
    expect(sp.grid).toBeUndefined();
    expect(sp.coverGrid).toEqual({ columns: 2, gap: 24 });
  });

  // A gallery.yaml written before the split has no `coverGrid` at all, and its
  // covers were sized by `grid`. Falling back to it keeps that page rendering
  // exactly as it did.
  it('falls back to the photo grid when no coverGrid was written', () => {
    const sp = subpage({ grid: { columns: 4, gap: 6, layout: 'uniform' } });
    expect(sp.coverGrid).toEqual({ columns: 4, gap: 6, layout: 'uniform' });
  });

  it('reports no cover override when the page states neither', () => {
    expect(subpage({}).coverGrid).toBeUndefined();
  });

  it('reads coverGrid from the map form of subpages too', () => {
    const gallery = deriveGallery({
      subpages: {
        Travel: { albums: [A], grid: { gap: 6 }, coverGrid: { columns: 2 } },
      },
    } as unknown as GalleryYaml);
    expect(gallery.subpages[0].grid).toEqual({ gap: 6 });
    expect(gallery.subpages[0].coverGrid).toEqual({ columns: 2 });
  });
});
