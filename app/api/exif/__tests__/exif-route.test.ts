import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The route serves the Immich asset description as a caption. It used to do so
 * unconditionally — captions were treated as editorial rather than technical —
 * which left it as the one field an operator could not hide (#506). Each group
 * is now switchable, and `exifOnHover: false` keeps meaning "no technical EXIF"
 * without touching captions.
 */

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}));

vi.mock('@/lib/immich', () => ({
  immich: { getAssetInfo: vi.fn(), getAlbum: vi.fn() },
  ImmichUnavailableError: class ImmichUnavailableError extends Error {},
}));

vi.mock('@/lib/tokens', () => ({
  decodeAssetId: vi.fn(() => 'asset-uuid'),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  retryAfterSeconds: vi.fn(() => 60),
}));

import { GET } from '../[id]/route';
// Not from '@/lib/config' — that module is mocked above.
import { resolveExifDisplay, type ExifDisplayYaml } from '@/lib/config/schema';
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';
import { NextRequest } from 'next/server';

const mockConfig = getConfig as unknown as ReturnType<typeof vi.fn>;
const mockAssetInfo = immich.getAssetInfo as unknown as ReturnType<typeof vi.fn>;
const mockGetAlbum = immich.getAlbum as unknown as ReturnType<typeof vi.fn>;

const EXIF_ASSET = {
  exifInfo: {
    make: 'Fujifilm',
    model: 'X-T5',
    lensModel: 'XF 35mm',
    focalLength: 35,
    fNumber: 2,
    exposureTime: '1/250',
    iso: 200,
    city: 'Vienna',
    country: 'Austria',
    description: '  A quiet morning at the Danube.  ',
  },
};

function makeRequest() {
  return new NextRequest('http://localhost/api/exif/token123');
}

const params = { params: Promise.resolve({ id: 'token123' }) };

/** A config shaped the way getConfig() builds it, for the groups under test. */
function configWith(raw?: ExifDisplayYaml, exifOnHover?: boolean) {
  return {
    exifOnHover: exifOnHover !== false,
    exif: resolveExifDisplay(raw, exifOnHover),
    rateLimitRpm: 120,
    // No album restricts its location, so the place comes through as the
    // asset carries it — the shape getConfig() always builds (#469).
    albumLocationPrecision: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAssetInfo.mockResolvedValue(EXIF_ASSET);
});

describe('GET /api/exif/[id] captions', () => {
  it('includes the trimmed description alongside technical fields', async () => {
    mockConfig.mockReturnValue(configWith());

    const res = await GET(makeRequest(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model).toBe('X-T5');
    expect(body.description).toBe('A quiet morning at the Danube.');
  });

  it('serves only the caption when exifOnHover is disabled', async () => {
    mockConfig.mockReturnValue(configWith(undefined, false));

    const res = await GET(makeRequest(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.description).toBe('A quiet morning at the Danube.');
    expect(body).not.toHaveProperty('model');
    expect(body).not.toHaveProperty('iso');
  });

  it('omits the description entirely when the asset has none', async () => {
    mockConfig.mockReturnValue(configWith());
    mockAssetInfo.mockResolvedValue({
      exifInfo: { ...EXIF_ASSET.exifInfo, description: null },
    });

    const res = await GET(makeRequest(), params);
    const body = await res.json();
    expect(body).not.toHaveProperty('description');
  });

  it('drops the caption when the group is off', async () => {
    mockConfig.mockReturnValue(configWith({ caption: false }));

    const body = await (await GET(makeRequest(), params)).json();
    expect(body).not.toHaveProperty('description');
    expect(body.model).toBe('X-T5');
  });

  it('drops the location without touching the camera', async () => {
    mockConfig.mockReturnValue(configWith({ location: false }));

    const body = await (await GET(makeRequest(), params)).json();
    expect(body).not.toHaveProperty('city');
    expect(body).not.toHaveProperty('country');
    expect(body.model).toBe('X-T5');
    expect(body.iso).toBe(200);
  });

  it('drops the exposure settings without touching the camera', async () => {
    mockConfig.mockReturnValue(configWith({ settings: false }));

    const body = await (await GET(makeRequest(), params)).json();
    expect(body).not.toHaveProperty('iso');
    expect(body).not.toHaveProperty('fNumber');
    expect(body.lensModel).toBe('XF 35mm');
  });

  /** An empty object would render as a blank panel rather than "no data". */
  it('answers 404 when every group is switched off', async () => {
    mockConfig.mockReturnValue(
      configWith({ camera: false, settings: false, location: false, caption: false }),
    );

    const res = await GET(makeRequest(), params);
    expect(res.status).toBe(404);
  });

  it('answers 404 when the enabled groups carry nothing for this asset', async () => {
    mockConfig.mockReturnValue(configWith({ camera: false, settings: false, caption: false }));
    mockAssetInfo.mockResolvedValue({
      exifInfo: { ...EXIF_ASSET.exifInfo, city: null, country: null },
    });

    const res = await GET(makeRequest(), params);
    expect(res.status).toBe(404);
  });
});

/**
 * `location:` used to govern the map and nothing else, so an album asking to
 * be absent from it still named its city here (#469).
 */
describe('GET /api/exif/[id] album location precision', () => {
  /** The album that carries the asset the mocked token decodes to. */
  const carrying = { id: 'album-a', assets: [{ id: 'asset-uuid' }] };

  async function respond(precision: Record<string, string>) {
    mockConfig.mockReturnValue({ ...configWith(), albumLocationPrecision: precision });
    mockAssetInfo.mockResolvedValue(EXIF_ASSET);
    mockGetAlbum.mockResolvedValue(carrying);
    const res = await GET(new NextRequest('http://localhost/api/exif/token'), {
      params: Promise.resolve({ id: 'token' }),
    });
    return res.json();
  }

  it('names the city when nothing restricts it', async () => {
    expect(await respond({})).toMatchObject({ city: 'Vienna', country: 'Austria' });
  });

  it('drops the city but keeps the country at country precision', async () => {
    const body = await respond({ 'album-a': 'country' });
    expect(body.country).toBe('Austria');
    expect(body).not.toHaveProperty('city');
  });

  it('names no place at all when the album is hidden', async () => {
    const body = await respond({ 'album-a': 'hidden' });
    expect(body).not.toHaveProperty('city');
    expect(body).not.toHaveProperty('country');
    // The rest of the panel is untouched.
    expect(body.model).toBe('X-T5');
  });
});
