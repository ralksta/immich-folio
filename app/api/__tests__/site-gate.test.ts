import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Route handlers do not render through the root layout, so the page-level site
 * gate does not cover them. Without a check of their own, a locked site would
 * still stream every photo to anyone holding an asset URL.
 *
 * Adding a public content route means adding a row to GATED — a route that
 * forgets its guard then fails this suite instead of shipping. The OPEN list is
 * the deliberate counterpart: /api/health must stay reachable (a locked site
 * still has to answer a container health probe), and the login endpoint cannot
 * sit behind the lock it exists to open.
 */

vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283/api',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    STALE_MAX_AGE: 600,
    IMAGE_CACHE_VERSION: '1',
    IMMICH_TIMEOUT_MS: 15000,
    RATE_LIMIT_RPM: 1500,
    TRUSTED_PROXY_HOPS: 0,
  },
}));

const config = {
  authSecret: 'test-secret-that-is-at-least-32-chars-long',
  sitePassword: 'letmein',
  rateLimitRpm: 1500,
  exifOnHover: true,
  map: true,
  subpages: [],
  albumPasswords: {},
  theme: { accent: '#e60012', fonts: { heading: 'Inter', body: 'Inter', caption: 'Inter' } },
};

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
  getConfigOrNull: () => config,
}));

/** Routes read `nextUrl` and the client IP, so a bare Request is not enough. */
const request = (path: string) => new NextRequest(`http://localhost${path}`);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const GATED: { name: string; call: () => Promise<Response> }[] = [
  {
    name: 'GET /api/image/[id]',
    call: async () =>
      (await import('../image/[id]/route')).GET(
        request('/api/image/tok') as never,
        params('tok') as never,
      ),
  },
  {
    name: 'GET /api/video/[id]',
    call: async () =>
      (await import('../video/[id]/route')).GET(
        request('/api/video/tok') as never,
        params('tok') as never,
      ),
  },
  {
    name: 'GET /api/exif/[id]',
    call: async () =>
      (await import('../exif/[id]/route')).GET(
        request('/api/exif/tok') as never,
        params('tok') as never,
      ),
  },
  {
    name: 'GET /api/map',
    call: async () => (await import('../map/route')).GET(request('/api/map') as never),
  },
  {
    name: 'GET /api/og',
    call: async () => (await import('../og/route')).GET(request('/api/og?title=x') as never),
  },
];

describe('public content routes behind a locked site', () => {
  beforeEach(() => {
    config.sitePassword = 'letmein';
  });

  it.each(GATED)('$name answers 401 without a session', async ({ call }) => {
    const res = await call();
    expect(res.status).toBe(401);
  });

  it.each(GATED)('$name does not cache the refusal', async ({ call }) => {
    const res = await call();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(GATED)('$name stops gating once no password is set', async ({ name, call }) => {
    config.sitePassword = '';
    /*
     * Everything past the gate is unmocked, so a route may answer with its own
     * error or throw outright (Immich is absent, /api/map wants Next's request
     * store). Either is fine — the only claim here is that an open site does
     * not answer 401, i.e. the guard is genuinely opt-in.
     */
    const status = await call().then(
      (res) => res.status,
      () => 'threw past the gate',
    );
    expect(status, name).not.toBe(401);
  });
});

describe('routes that must stay open', () => {
  it('GET /api/health answers a locked site', async () => {
    config.sitePassword = 'letmein';
    const res = await (await import('../health/route')).GET(request('/api/health') as never);
    // A health probe runs without cookies; a 401 here takes the container down.
    expect(res.status).not.toBe(401);
  });

  it('POST /api/auth is not behind the lock it opens', async () => {
    config.sitePassword = 'letmein';
    const res = await (
      await import('../auth/route')
    ).POST(
      new Request('http://localhost/api/auth', {
        method: 'POST',
        body: JSON.stringify({ slug: 'site', password: 'letmein', type: 'site' }),
      }) as never,
    );
    expect(res.status).toBe(200);
  });
});
