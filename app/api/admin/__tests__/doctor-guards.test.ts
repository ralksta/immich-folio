import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The report names album titles, password locations and proxy topology. Like
 * every other /api/admin route it has to check both guards itself — there is no
 * shared middleware (see admin-guards.test.ts).
 */
const enabled = vi.fn(() => true);
const authed = vi.fn(async () => true);

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: () => enabled(),
  isAdminAuthenticated: async () => authed(),
  COOKIE_NAME: 'folio_admin_session',
}));

const baseConfig = {
  needsCredentials: true,
  trustedProxyHops: 0,
  authSecret: 'x'.repeat(64),
  albums: [] as string[],
  standaloneAlbums: [] as string[],
  albumOverrides: {} as Record<string, string>,
  subpages: [] as Array<{ name: string; albumIds: string[] }>,
  albumPasswords: {},
  sitePassword: '',
  immich: { apiUrl: '', apiKey: '' },
  immichTimeoutMs: 1000,
  legal: {
    enabled: false,
    name: '',
    address: '',
    zipCity: '',
    country: '',
  } as Record<string, unknown>,
  contact: { enabled: false, retentionDays: 90 } as Record<string, unknown>,
};
const getConfigMock = vi.fn(() => baseConfig);

vi.mock('@/lib/config', () => ({
  getConfig: () => getConfigMock(),
  slugify: (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
}));

vi.mock('@/lib/env', () => ({ env: { AUTH_SECRET: 'x'.repeat(64) } }));
vi.mock('@/lib/admin/journal-service', () => ({ listJournalEntries: async () => [] }));
const readSettingsYamlMock = vi.fn(async (): Promise<unknown> => null);
vi.mock('@/lib/admin/yaml-service', () => ({ readSettingsYaml: () => readSettingsYamlMock() }));

import { GET } from '../doctor/route';
import { NextRequest } from 'next/server';

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/admin/doctor', { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  enabled.mockReturnValue(true);
  authed.mockResolvedValue(true);
});

describe('GET /api/admin/doctor', () => {
  it('refuses when the admin panel is disabled', async () => {
    enabled.mockReturnValue(false);
    expect((await GET(req())).status).toBe(403);
  });

  it('refuses an unauthenticated caller', async () => {
    authed.mockResolvedValue(false);
    expect((await GET(req())).status).toBe(401);
  });

  it('reports findings and the worst level', async () => {
    const body = await (await GET(req())).json();
    expect(Array.isArray(body.findings)).toBe(true);
    expect(['ok', 'warn', 'error']).toContain(body.level);
    // Missing credentials must surface as an error, not a silent pass.
    expect(body.level).toBe('error');
  });

  /** The proxy check reads the chain off the request being served. */
  it('measures the forwarded chain of the incoming request', async () => {
    const body = await (await GET(req({ 'x-forwarded-for': '203.0.113.9, 10.0.0.2' }))).json();
    const proxy = body.findings.find((f: { id: string }) => f.id === 'proxy-hops');
    expect(proxy.level).toBe('warn');
    expect(proxy.title).toContain('2');
  });

  /**
   * Next writes X-Forwarded-For itself for a direct request, so this must stay
   * quiet — otherwise the warning fires on every proxy-less deployment.
   */
  it('stays quiet on the single entry Next synthesises', async () => {
    const body = await (await GET(req({ 'x-forwarded-for': '127.0.0.1' }))).json();
    const proxy = body.findings.find((f: { id: string }) => f.id === 'proxy-hops');
    expect(proxy.level).toBe('ok');
  });

  it('trusts a lone entry that a proxy header corroborates', async () => {
    const body = await (
      await GET(req({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' }))
    ).json();
    const proxy = body.findings.find((f: { id: string }) => f.id === 'proxy-hops');
    expect(proxy.level).toBe('warn');
  });
});

/**
 * `if (albums.length)` used to skip the album check entirely when Immich
 * answered with an empty list — an API key regenerated under a different
 * account, say — so every connection check passed while every album page was
 * silently empty (#629).
 */
describe('GET /api/admin/doctor — album checks', () => {
  const ALBUM_ID = '11111111-1111-1111-1111-111111111111';

  function withCredentialsAndAlbums(albums: string[]) {
    getConfigMock.mockReturnValueOnce({
      ...baseConfig,
      needsCredentials: false,
      albums,
      immich: { apiUrl: 'https://immich.example', apiKey: 'key' },
    });
  }

  it('reports every configured album as missing when Immich returns an empty list', async () => {
    withCredentialsAndAlbums([ALBUM_ID]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/albums')) return { ok: true, json: async () => [] } as Response;
        return { ok: true, json: async () => ({}) } as Response;
      }),
    );

    const body = await (await GET(req())).json();
    const albumFinding = body.findings.find((f: { id: string }) => f.id === 'album-ids');

    expect(albumFinding?.level).toBe('error');
    expect(albumFinding?.title).toContain('1 of 1');

    vi.unstubAllGlobals();
  });

  it('does not reject a non-array album response outright', async () => {
    withCredentialsAndAlbums([ALBUM_ID]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/albums')) return { ok: true, json: async () => ({}) } as Response;
        return { ok: true, json: async () => ({}) } as Response;
      }),
    );

    const body = await (await GET(req())).json();
    const albumFinding = body.findings.find((f: { id: string }) => f.id === 'album-ids');

    // A non-array body is treated the same as an empty list, not left uncast
    // and unchecked.
    expect(albumFinding?.level).toBe('error');

    vi.unstubAllGlobals();
  });
});

/**
 * Two albums that slugify to the same URL leave the second unreachable and
 * its settings resolved from the first (#632).
 */
describe('GET /api/admin/doctor — album slug collisions', () => {
  const knownAlbums = [
    { id: 'a', albumName: 'Japan Trip' },
    { id: 'b', albumName: 'Japan-Trip' },
  ];

  function withCredentialsAndAlbums(config: Partial<typeof baseConfig>) {
    getConfigMock.mockReturnValueOnce({
      ...baseConfig,
      needsCredentials: false,
      immich: { apiUrl: 'https://immich.example', apiKey: 'key' },
      ...config,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/albums')) return { ok: true, json: async () => knownAlbums } as Response;
        return { ok: true, json: async () => ({}) } as Response;
      }),
    );
  }

  it('flags two standalone albums whose Immich names slugify alike', async () => {
    withCredentialsAndAlbums({ albums: ['a', 'b'], standaloneAlbums: ['a', 'b'] });

    const body = await (await GET(req())).json();
    const finding = body.findings.find((f: { id: string }) => f.id === 'album-slugs');

    expect(finding?.level).toBe('error');
    expect(finding?.detail).toContain('Japan Trip');
    expect(finding?.detail).toContain('Japan-Trip');

    vi.unstubAllGlobals();
  });

  it('is quiet when the same names live in different subpages', async () => {
    withCredentialsAndAlbums({
      albums: ['a', 'b'],
      standaloneAlbums: [],
      subpages: [
        { name: 'Trips A', albumIds: ['a'] },
        { name: 'Trips B', albumIds: ['b'] },
      ],
    });

    const body = await (await GET(req())).json();
    const finding = body.findings.find((f: { id: string }) => f.id === 'album-slugs');

    expect(finding?.level).toBe('ok');

    vi.unstubAllGlobals();
  });
});

/**
 * resolveLegal() drops a non-http(s) contact URL and only tells the server
 * log. The doctor reads the raw settings.yaml so the admin sees why the link
 * is gone.
 */
describe('GET /api/admin/doctor — Impressum', () => {
  const complete = {
    enabled: true,
    name: 'Ralf',
    address: 'Street 1',
    zipCity: '10247 Berlin',
    country: 'Germany',
    email: 'mail@example.com',
  };

  it('stays out of the report while the page is off', async () => {
    const body = await (await GET(req())).json();
    expect(body.findings.find((f: { id: string }) => f.id === 'legal')).toBeUndefined();
  });

  it('names a contact URL that the page dropped', async () => {
    readSettingsYamlMock.mockResolvedValueOnce({
      legal: { ...complete, contactUrl: 'javascript:alert(1)' },
    });

    const body = await (await GET(req())).json();
    const finding = body.findings.find((f: { id: string }) => f.id === 'legal');

    expect(finding?.level).toBe('warn');
    expect(finding?.detail).toContain('contact form URL is ignored');
  });
});
