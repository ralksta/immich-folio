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
  contact: { enabled: true, retentionDays: 90 },
  siteUrl: null,
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
  {
    name: 'GET /api/download/[album]/archive',
    call: async () =>
      (await import('../download/[album]/archive/route')).GET(
        request('/api/download/tok/archive') as never,
        { params: Promise.resolve({ album: 'tok' }) } as never,
      ),
  },
  {
    name: 'GET /api/download/[album]/[id]',
    call: async () =>
      (await import('../download/[album]/[id]/route')).GET(
        request('/api/download/tok/tok') as never,
        { params: Promise.resolve({ album: 'tok', id: 'tok' }) } as never,
      ),
  },
  // Client proofing links: the site password applies to clients as well.
  {
    name: 'PUT /api/proof/[token]/selection',
    call: async () =>
      (await import('../proof/[token]/selection/route')).PUT(
        new NextRequest('http://localhost/api/proof/tok/selection', {
          method: 'PUT',
          body: '{"selection":[]}',
        }) as never,
        { params: Promise.resolve({ token: 'tok' }) } as never,
      ),
  },
  {
    name: 'POST /api/proof/[token]/submit',
    call: async () =>
      (await import('../proof/[token]/submit/route')).POST(
        new NextRequest('http://localhost/api/proof/tok/submit', { method: 'POST' }) as never,
        { params: Promise.resolve({ token: 'tok' }) } as never,
      ),
  },
  {
    name: 'GET /api/proof/[token]/archive',
    call: async () =>
      (await import('../proof/[token]/archive/route')).GET(
        request('/api/proof/tok/archive') as never,
        { params: Promise.resolve({ token: 'tok' }) } as never,
      ),
  },
  {
    // Stores whatever a visitor sends; a locked site accepts nothing from strangers.
    name: 'POST /api/contact',
    call: async () =>
      (await import('../contact/route')).POST(
        new NextRequest('http://localhost/api/contact', { method: 'POST', body: '{}' }) as never,
      ),
  },
];

/**
 * Routes that answer a locked site on purpose, keyed like the GATED names
 * (path under /api). Everything else under app/api must be in GATED.
 * /api/admin is absent: it has its own password and its own suite
 * (app/api/admin/__tests__/admin-guards.test.ts).
 */
const OPEN: Record<string, string> = {
  health: 'a container health probe runs without cookies',
  auth: 'the login endpoint cannot sit behind the lock it opens',
  'fonts/css': 'the gate page is set in the theme fonts',
  'fonts/file/[name]': 'the gate page is set in the theme fonts',
  favicon: 'the gate page shows the site icon',
  install: 'the first-run wizard; setup-token gated, refuses once installed',
  'install/albums': 'the first-run wizard; setup-token gated, refuses once installed',
  webhook: 'server-to-server from Immich, HMAC-verified',
  'analytics/track': 'counts a view of the gate itself; returns no content',
};

/** `GET /api/download/[album]/[id]` → `download/[album]/[id]`. */
const routeDir = (name: string) => name.replace(/^[A-Z]+ \/api\//, '');

describe('site gate coverage', () => {
  it('has a GATED or OPEN row for every public route module under app/api', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const apiDir = path.join(process.cwd(), 'app/api');

    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          walk(full);
        } else if (/^route\.tsx?$/.test(entry.name)) {
          found.push(path.relative(apiDir, path.dirname(full)).replace(/\\/g, '/'));
        }
      }
    };
    walk(apiDir);

    const covered = new Set([...GATED.map((r) => routeDir(r.name)), ...Object.keys(OPEN)]);
    const uncovered = found.filter((p) => !p.startsWith('admin/') && !covered.has(p));

    expect(uncovered, `Public API routes with no site-gate row: ${uncovered.join(', ')}`).toEqual(
      [],
    );
  });

  it('lists no route in OPEN that does not exist', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const missing = Object.keys(OPEN).filter((dir) => {
      const base = path.join(process.cwd(), 'app/api', dir);
      return (
        !fs.existsSync(path.join(base, 'route.ts')) && !fs.existsSync(path.join(base, 'route.tsx'))
      );
    });
    expect(missing).toEqual([]);
  });
});

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

  // The password gate is set in the theme's fonts; locking them would render
  // the gate itself in fallback fonts. Three public font names give nothing away.
  it('GET /api/fonts/css answers a locked site', async () => {
    config.sitePassword = 'letmein';
    const res = await (
      await import('../fonts/css/route')
    ).GET(request('/api/fonts/css?family=Inter%3Ax') as never);
    expect(res.status).not.toBe(401);
  });

  it('GET /api/fonts/file/[name] answers a locked site', async () => {
    config.sitePassword = 'letmein';
    const res = await (
      await import('../fonts/file/[name]/route')
    ).GET(request('/api/fonts/file/x.woff2') as never, {
      params: Promise.resolve({ name: 'x.woff2' }),
    });
    expect(res.status).not.toBe(401);
  });
});
