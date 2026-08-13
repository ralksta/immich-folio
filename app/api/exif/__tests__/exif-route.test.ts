import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * EXPERIMENTAL captions (L10): the route serves the Immich asset description
 * as a caption. Captions are editorial, not technical — so exifOnHover: false
 * must strip the technical fields but still serve the caption, instead of the
 * old blanket 403.
 */

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}));

vi.mock('@/lib/immich', () => ({
  immich: { getAssetInfo: vi.fn() },
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
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';
import { NextRequest } from 'next/server';

const mockConfig = getConfig as unknown as ReturnType<typeof vi.fn>;
const mockAssetInfo = immich.getAssetInfo as unknown as ReturnType<typeof vi.fn>;

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

beforeEach(() => {
  vi.clearAllMocks();
  mockAssetInfo.mockResolvedValue(EXIF_ASSET);
});

describe('GET /api/exif/[id] captions', () => {
  it('includes the trimmed description alongside technical fields', async () => {
    mockConfig.mockReturnValue({ exifOnHover: true, rateLimitRpm: 120 });

    const res = await GET(makeRequest(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model).toBe('X-T5');
    expect(body.description).toBe('A quiet morning at the Danube.');
  });

  it('serves only the caption when exifOnHover is disabled', async () => {
    mockConfig.mockReturnValue({ exifOnHover: false, rateLimitRpm: 120 });

    const res = await GET(makeRequest(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.description).toBe('A quiet morning at the Danube.');
    expect(body).not.toHaveProperty('model');
    expect(body).not.toHaveProperty('iso');
  });

  it('omits the description entirely when the asset has none', async () => {
    mockConfig.mockReturnValue({ exifOnHover: true, rateLimitRpm: 120 });
    mockAssetInfo.mockResolvedValue({
      exifInfo: { ...EXIF_ASSET.exifInfo, description: null },
    });

    const res = await GET(makeRequest(), params);
    const body = await res.json();
    expect(body).not.toHaveProperty('description');
  });
});
