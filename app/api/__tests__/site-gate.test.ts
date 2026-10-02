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
  legal: { enabled: true },
  privacy: { enabled: true },
  siteUrl: null,
  // Past the gate, /api/analytics/track would write content/analytics.json in
  // the checkout; turned off, it answers without writing. The gate runs first,
  // so the locked-site rows still exercise it.
  analytics: false,
};

/*
 * The contact route stores what it accepts under content/messages/ and pushes
 * to contact.notifyUrl. Both are replaced here, so an accepted submission
 * touches neither the checkout's content/ directory nor the network;
 * validateContact stays real, honeypot and fill-time check included.
 */
const contactStore = vi.hoisted(() => ({
  saveMessage: vi.fn(async (fields: Record<string, string>) => ({ id: 'x', ...fields })),
  notifyNewMessage: vi.fn(async () => {}),
}));
vi.mock('@/lib/contact', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/contact')>()),
  ...contactStore,
}));

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
  {
    // The lightbox zoom's full-resolution file (#467).
    name: 'GET /api/zoom/[album]/[id]',
    call: async () =>
      (await import('../zoom/[album]/[id]/route')).GET(
        request('/api/zoom/tok/tok') as never,
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
    // Writes visitor-chosen paths into content/analytics.json. It used to be
    // OPEN "to count the gate", but the layout mounts no tracker on the gate.
    name: 'POST /api/analytics/track',
    call: async () =>
      (await import('../analytics/track/route')).POST(
        new NextRequest('http://localhost/api/analytics/track', {
          method: 'POST',
          body: '{"path":"/"}',
        }) as never,
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
  contact:
    'the Impressum links the form as its second contact channel, and /contact is served to a locked site',
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
  describe('POST /api/contact on a locked site', () => {
    /** Own rate-limit bucket per case: the route allows three a minute per IP. */
    const submit = (ip: string, fields: Record<string, unknown>) =>
      import('../contact/route').then(({ POST }) =>
        POST(
          new NextRequest('http://localhost/api/contact', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-real-ip': ip },
            body: JSON.stringify(fields),
          }) as never,
        ),
      );
    const valid = () => ({
      name: 'Erika',
      email: 'erika@example.com',
      message: 'Wer betreibt diese Seite?',
      website: '',
      startedAt: Date.now() - 10_000,
    });

    beforeEach(() => {
      config.sitePassword = 'letmein';
      contactStore.saveMessage.mockClear();
    });

    // The Impressum links the form as its second contact channel, and the
    // proxy serves /contact to a locked site; the endpoint has to take the post.
    it('accepts a valid message without a session', async () => {
      const res = await submit('10.0.0.1', valid());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(contactStore.saveMessage).toHaveBeenCalledTimes(1);
    });

    it('still drops a filled honeypot and a form sent too fast, unsaved', async () => {
      expect((await submit('10.0.0.2', { ...valid(), website: 'spam.example' })).status).toBe(200);
      expect((await submit('10.0.0.2', { ...valid(), startedAt: Date.now() })).status).toBe(200);
      expect(contactStore.saveMessage).not.toHaveBeenCalled();
    });

    it('still refuses an invalid message', async () => {
      const res = await submit('10.0.0.3', { ...valid(), email: 'not-an-address' });
      expect(res.status).toBe(400);
      expect(contactStore.saveMessage).not.toHaveBeenCalled();
    });

    it('still rate-limits at three a minute', async () => {
      for (let i = 0; i < 3; i++) expect((await submit('10.0.0.4', valid())).status).toBe(200);
      expect((await submit('10.0.0.4', valid())).status).toBe(429);
    });
  });

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

/*
 * The pages, not the route handlers: proxy.ts gates those. Driven through the
 * real lib/auth here, with the password set, rather than through a mocked
 * isSiteUnlocked() as in lib/__tests__/proxy.test.ts.
 */
describe('legal and contact pages on a locked site', () => {
  const page = async (path: string, cookie?: string) =>
    (await import('@/proxy')).proxy(
      new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : {}),
    );
  const rewrittenTo = (res: Response) => res.headers.get('x-middleware-rewrite');

  beforeEach(() => {
    config.sitePassword = 'letmein';
    config.legal.enabled = true;
    config.privacy.enabled = true;
    config.contact.enabled = true;
  });

  // The gate page is public and links both. A German Impressum has to be
  // reachable directly, and neither page carries an album name or asset token.
  it.each(['/impressum', '/privacy', '/contact'])(
    '%s is served without the password',
    async (path) => {
      expect(rewrittenTo(await page(path))).toBeNull();
    },
  );

  it('every other page is still rewritten to the gate', async () => {
    for (const path of ['/', '/japan', '/journal', '/about', '/contact/x', '/impressum/x']) {
      expect(rewrittenTo(await page(path)), path).toContain('/gate');
    }
  });

  it('a switched-off legal or contact page is still a 404, not the gate', async () => {
    config.legal.enabled = false;
    config.privacy.enabled = false;
    config.contact.enabled = false;
    for (const path of ['/impressum', '/privacy', '/contact']) {
      const res = await page(path);
      expect(rewrittenTo(res), path).toBeNull();
      expect(res.status, path).toBe(404);
    }
  });
});
