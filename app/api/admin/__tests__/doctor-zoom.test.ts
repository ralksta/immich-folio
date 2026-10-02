import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The doctor's zoom check (#467) samples one photo that zoom serves through
 * Immich's full-size rendition. A rendition in a format the zoom route refuses
 * (WebP) is not "fine" — the doctor used to say OK because one existed.
 */

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: () => true,
  isAdminAuthenticated: async () => true,
  COOKIE_NAME: 'folio_admin_session',
}));

const ALBUM = '11111111-1111-1111-1111-111111111111';
const config = {
  needsCredentials: false,
  trustedProxyHops: 0,
  authSecret: 'x'.repeat(64),
  albums: [ALBUM],
  standaloneAlbums: [ALBUM],
  standaloneAlbumZoom: {},
  zoom: true,
  albumOverrides: {},
  albumDownloads: {},
  subpages: [],
  albumPasswords: {},
  sitePassword: '',
  immich: { apiUrl: 'https://immich.example/api', apiKey: 'key' },
  immichTimeoutMs: 1000,
  legal: { enabled: false, name: '', address: '', zipCity: '', country: '' },
  contact: { enabled: false, retentionDays: 90 },
  privacy: { enabled: true },
};

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
  slugify: (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}));
vi.mock('@/lib/env', () => ({ env: { AUTH_SECRET: 'x'.repeat(64) } }));
vi.mock('@/lib/admin/journal-service', () => ({ listJournalEntries: async () => [] }));
vi.mock('@/lib/admin/yaml-service', () => ({ readSettingsYaml: async () => null }));

const immichMock = vi.hoisted(() => ({ getAlbum: vi.fn(), streamFullsize: vi.fn() }));
vi.mock('@/lib/immich', () => ({ immich: immichMock }));

import { GET } from '../doctor/route';
import { NextRequest } from 'next/server';

const zoomFinding = async () => {
  const body = await (await GET(new NextRequest('http://localhost/api/admin/doctor'))).json();
  return body.findings.find((f: { id: string }) => f.id === 'zoom-renditions');
};

const rendition = (contentType: string) => ({
  stream: new ReadableStream(),
  contentType,
  contentLength: '10',
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('/albums')
        ? ({ ok: true, json: async () => [{ id: ALBUM, albumName: 'Trip' }] } as Response)
        : ({ ok: true, json: async () => ({}) } as Response),
    ),
  );
  immichMock.getAlbum.mockResolvedValue({
    id: ALBUM,
    albumName: 'Trip',
    assets: [{ id: 'heic', type: 'IMAGE', originalMimeType: 'image/heic' }],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('GET /api/admin/doctor — zoom renditions', () => {
  it('is OK for a JPEG rendition', async () => {
    immichMock.streamFullsize.mockResolvedValue(rendition('image/jpeg'));
    expect((await zoomFinding())?.level).toBe('ok');
    expect(immichMock.streamFullsize).toHaveBeenCalledWith('heic');
  });

  it('warns when Immich has none', async () => {
    immichMock.streamFullsize.mockResolvedValue(null);
    const finding = await zoomFinding();
    expect(finding?.level).toBe('warn');
    expect(finding?.title).toMatch(/no full-size preview/);
  });

  it('warns, asking for JPEG, when the rendition is WebP (review of #830)', async () => {
    immichMock.streamFullsize.mockResolvedValue(rendition('image/webp'));
    const finding = await zoomFinding();
    expect(finding?.level).toBe('warn');
    expect(finding?.title).toMatch(/not JPEG/);
  });
});
