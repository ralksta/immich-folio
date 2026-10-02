import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/*
 * The gate is mocked rather than driven through a real config: proxy() now
 * consults it on every request, and reading the repository's own
 * content/settings.yaml would make these tests depend on how the working copy
 * happens to be configured. lib/__tests__/site-password.test.ts covers the
 * verification itself.
 */
vi.mock('@/lib/auth', () => ({
  isSiteUnlocked: vi.fn(() => true),
}));

vi.mock('@/lib/cdn', () => ({
  cdnOrigin: vi.fn(() => null),
}));

// Null by default: isKnownMissing() then leaves every path to the page.
vi.mock('@/lib/config', () => ({
  getConfigOrNull: vi.fn(() => null),
}));

import { isSiteUnlocked } from '@/lib/auth';
import { cdnOrigin } from '@/lib/cdn';
import { tryToParsePath } from 'next/dist/lib/try-to-parse-path';
import { proxy, config, isKnownMissing, TOP_LEVEL_ROUTES } from '@/proxy';
import { getConfigOrNull } from '@/lib/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mockUnlocked = isSiteUnlocked as unknown as ReturnType<typeof vi.fn>;
const mockCdnOrigin = cdnOrigin as unknown as ReturnType<typeof vi.fn>;
const mockConfig = getConfigOrNull as unknown as ReturnType<typeof vi.fn>;

// Next.js 16 renamed the "middleware" file convention to "proxy": the file must
// be proxy.ts and must export proxy(), not middleware(). A silent regression here
// (wrong filename, wrong export name) means Next.js never invokes this code and
// every document response ships without a CSP — with no build error to catch it.
describe('proxy', () => {
  const run = (pathname = '/') => proxy(new NextRequest(`https://example.com${pathname}`));

  beforeEach(() => {
    mockUnlocked.mockReturnValue(true);
    mockCdnOrigin.mockReturnValue(null);
    mockConfig.mockReturnValue(null);
  });

  describe('CDN mode', () => {
    it('leaves the policy untouched without a CDN', () => {
      const csp = run().headers.get('Content-Security-Policy')!;
      expect(csp).not.toContain('media-src');
    });

    it('allows the CDN origin for images and video', () => {
      mockCdnOrigin.mockReturnValue('https://cdn.example.net');
      const csp = run().headers.get('Content-Security-Policy')!;
      const directive = (name: string) =>
        csp
          .split(';')
          .map((d) => d.trim())
          .find((d) => d.startsWith(`${name} `));
      expect(directive('img-src')).toContain('https://cdn.example.net');
      expect(directive('media-src')).toBe("media-src 'self' https://cdn.example.net");
      // Scripts never come from the CDN.
      expect(directive('script-src')).not.toContain('cdn.example.net');
    });
  });

  it('is exported under the name Next.js 16 expects', () => {
    expect(typeof proxy).toBe('function');
  });

  it('sets a Content-Security-Policy on the response', () => {
    const csp = run().headers.get('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('issues a per-request nonce and passes it to pages via x-nonce', () => {
    const response = run();
    const nonce = response.headers.get('x-middleware-request-x-nonce');
    expect(nonce).toBeTruthy();
    // The nonce in the CSP must be the same one the page receives, otherwise
    // Next.js stamps scripts with a nonce the policy does not allow.
    expect(response.headers.get('Content-Security-Policy')).toContain(`'nonce-${nonce}'`);
  });

  it('generates a different nonce per request', () => {
    const first = run().headers.get('x-middleware-request-x-nonce');
    const second = run().headers.get('x-middleware-request-x-nonce');
    expect(first).not.toBe(second);
  });

  it('forwards the pathname so the root layout can keep /admin reachable', () => {
    const response = run('/admin/settings');
    expect(response.headers.get('x-middleware-request-x-pathname')).toBe('/admin/settings');
  });

  it('does not set unsafe-inline alongside the nonce', () => {
    // CSP2-only browsers ignore 'strict-dynamic' and would honour the fallback,
    // making it strictly worse than having none.
    expect(run().headers.get('Content-Security-Policy')).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });

  it('adds unsafe-eval to script-src in development mode for React dev tools and Fast Refresh', () => {
    const envObj = process.env as Record<string, string | undefined>;
    const origEnv = envObj.NODE_ENV;
    try {
      envObj.NODE_ENV = 'development';
      expect(run().headers.get('Content-Security-Policy')).toContain("'unsafe-eval'");
    } finally {
      envObj.NODE_ENV = origEnv;
    }
  });

  it('omits unsafe-eval in production/test environments', () => {
    expect(run().headers.get('Content-Security-Policy')).not.toContain("'unsafe-eval'");
  });

  it('keeps a matcher that excludes api and static assets but covers /admin', () => {
    const source = config.matcher[0];
    expect(source).toContain('api');
    expect(source).toContain('_next/static');
    expect(source).not.toContain('admin');
  });

  /**
   * Reading the pattern is not enough: whether a path reaches proxy() is
   * decided by the regex Next compiles from it, so that is what gets tested.
   * A path the matcher skips gets no site gate and no CSP.
   */
  describe('matcher, compiled the way Next compiles it', () => {
    const compiled = tryToParsePath(config.matcher[0]);
    const reaches = (pathname: string) => new RegExp(compiled.regexStr!).test(pathname);

    it('compiles', () => {
      expect(compiled.error).toBeUndefined();
      expect(compiled.regexStr).toBeTruthy();
    });

    it.each(['/', '/journal', '/japan/kyoto', '/admin', '/admin/pages', '/gate', '/install'])(
      'runs on %s',
      (pathname) => expect(reaches(pathname)).toBe(true),
    );

    it.each([
      '/api',
      '/api/image/v2:abc',
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/favicon.ico',
      '/sitemap.xml',
      '/robots.txt',
    ])('skips %s', (pathname) => expect(reaches(pathname)).toBe(false));

    // An exclusion is a whole segment or a whole filename, never a prefix: a
    // page whose slug happens to start with one must still be gated.
    it.each([
      '/apia-samoa',
      '/apiary',
      '/api-docs',
      '/_next/staticfoo',
      '/_next/imagery',
      '/sitemapXxml',
      '/robots1txt',
      '/faviconXico',
      '/robots.txt.bak',
      '/sitemap.xml/extra',
    ])('runs on %s, which only looks like an exclusion', (pathname) =>
      expect(reaches(pathname)).toBe(true),
    );
  });

  /**
   * The gate resolves the site password through getConfig(), which throws on a
   * config it cannot parse — inside the proxy, before app/layout.tsx can fall
   * back to the setup screen. Unhandled, one typo in gallery.yaml became a bare
   * 500 on every route (#516).
   */
  it('serves the page instead of a 500 when the config cannot be read', () => {
    mockUnlocked.mockImplementation(() => {
      throw new Error('duplicated mapping key');
    });

    const res = proxy(new NextRequest('https://example.com/japan'));

    // Not a rewrite to the gate, and not a throw: the page renders and shows
    // the setup screen, which is the thing that can explain the fault.
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('still gates a locked site when the config is fine', () => {
    mockUnlocked.mockReturnValue(false);

    const res = proxy(new NextRequest('https://example.com/japan'));

    expect(res.headers.get('x-middleware-rewrite')).toContain('/gate');
  });

  it('no longer lets the matcher skip prefetches', () => {
    /*
     * The exclusion used to live in the matcher. It moved into proxy() when the
     * site gate was added: a matcher that skips prefetches skips the gate with
     * them, and a prefetch asks for the same RSC payload as a navigation — so
     * one request header would have walked straight past a locked site.
     */
    expect(JSON.stringify(config.matcher)).not.toContain('next-router-prefetch');
  });

  it('still leaves prefetches without a nonce or a policy', () => {
    const prefetch = proxy(
      new NextRequest('https://example.com/', { headers: { 'next-router-prefetch': '1' } }),
    );
    expect(prefetch.headers.get('Content-Security-Policy')).toBeNull();
    expect(prefetch.headers.get('x-middleware-request-x-nonce')).toBeNull();

    const purpose = proxy(
      new NextRequest('https://example.com/', { headers: { purpose: 'prefetch' } }),
    );
    expect(purpose.headers.get('Content-Security-Policy')).toBeNull();
  });

  describe('site-wide gate', () => {
    /** The header a rewrite response carries, holding the rewritten URL. */
    const rewrittenTo = (res: Response) => res.headers.get('x-middleware-rewrite');

    it('rewrites a locked-out visitor to the gate instead of rendering the page', () => {
      mockUnlocked.mockReturnValue(false);
      // A redirect would lose the requested URL; a rewrite keeps it, so
      // unlocking lands the visitor where they were going.
      expect(rewrittenTo(run('/japan/osaka-2023'))).toContain('/gate');
    });

    it('gates a prefetch too', () => {
      mockUnlocked.mockReturnValue(false);
      const res = proxy(
        new NextRequest('https://example.com/japan', {
          headers: { 'next-router-prefetch': '1' },
        }),
      );
      // A prefetch asks for the same payload as a navigation. If the gate ran
      // after the prefetch shortcut, one header would walk straight past it.
      expect(rewrittenTo(res)).toContain('/gate');
    });

    it('leaves /admin and /install reachable', () => {
      mockUnlocked.mockReturnValue(false);
      // /admin owns its own password and is where the site password is set;
      // /install is what a fresh deployment needs before it can have one.
      expect(rewrittenTo(run('/admin'))).toBeNull();
      expect(rewrittenTo(run('/admin/settings/general'))).toBeNull();
      expect(rewrittenTo(run('/install'))).toBeNull();
    });

    it('serves the legal notice and the privacy policy to a locked site', () => {
      mockUnlocked.mockReturnValue(false);
      mockConfig.mockReturnValue({
        contact: { enabled: true },
        legal: { enabled: true },
        map: true,
        privacy: { enabled: true },
      });
      // The gate page is public and links both; an Impressum behind a password
      // is not "unmittelbar erreichbar". The pages still get their CSP.
      // The contact form goes with them: the Impressum links it as its second
      // contact channel.
      for (const pathname of ['/impressum', '/privacy', '/contact']) {
        const res = run(pathname);
        expect(rewrittenTo(res)).toBeNull();
        expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
      }
      // Exact paths only: nothing below or beside them slips through.
      for (const pathname of ['/', '/contact/x', '/impressum/x', '/privacy-trip', '/japan']) {
        expect(rewrittenTo(run(pathname))).toContain('/gate');
      }
    });

    it('still answers 404 for a legal or contact page that is switched off on a locked site', () => {
      mockUnlocked.mockReturnValue(false);
      mockConfig.mockReturnValue({
        contact: { enabled: false },
        legal: { enabled: false },
        map: false,
        privacy: { enabled: false },
      });
      for (const pathname of ['/impressum', '/privacy', '/contact']) {
        const res = run(pathname);
        expect(rewrittenTo(res)).toBeNull();
        expect(res.status).toBe(404);
      }
    });

    it('does not rewrite the gate to itself', () => {
      mockUnlocked.mockReturnValue(false);
      expect(rewrittenTo(run('/gate'))).toBeNull();
    });

    it('stays out of the way when the site is unlocked', () => {
      expect(rewrittenTo(run('/japan/osaka-2023'))).toBeNull();
      expect(run().headers.get('Content-Security-Policy')).toBeTruthy();
    });
  });
});

/*
 * app/loading.tsx makes every page stream, so notFound() in a page can no
 * longer change the 200 that was already sent. Routes whose existence the
 * proxy can decide on its own get the 404 before streaming starts.
 */
describe('isKnownMissing', () => {
  let contentDir: string;
  const settings = {
    contact: { enabled: false },
    legal: { enabled: true },
    map: false,
    privacy: { enabled: true },
  };

  beforeEach(() => {
    contentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-proxy-'));
    fs.mkdirSync(path.join(contentDir, 'journal'));
    fs.writeFileSync(path.join(contentDir, 'journal', 'kyoto.md'), '---\ntitle: Kyoto\n---\n');
    mockConfig.mockReturnValue(settings);
  });

  it('knows the pages that are switched off in settings', () => {
    expect(isKnownMissing('/contact', contentDir)).toBe(true);
    expect(isKnownMissing('/map', contentDir)).toBe(true);
    expect(isKnownMissing('/impressum', contentDir)).toBe(false);
  });

  it('knows /privacy by its switch and its file', () => {
    expect(isKnownMissing('/privacy', contentDir)).toBe(true);
    fs.writeFileSync(path.join(contentDir, 'privacy.md'), '## Datenschutz\n');
    expect(isKnownMissing('/privacy', contentDir)).toBe(false);
  });

  it('knows a journal entry by its file, and rejects slugs that are not slugs', () => {
    expect(isKnownMissing('/journal/kyoto', contentDir)).toBe(false);
    expect(isKnownMissing('/journal/osaka', contentDir)).toBe(true);
    expect(isKnownMissing('/journal/..%2Fsettings', contentDir)).toBe(true);
  });

  it('treats a malformed escape in a journal slug as missing instead of throwing', () => {
    expect(isKnownMissing('/journal/%E0', contentDir)).toBe(true);
    expect(proxy(new NextRequest('https://example.com/journal/%E0')).status).toBe(404);
  });

  it('leaves album and subpage slugs to the page, which needs Immich to decide', () => {
    expect(isKnownMissing('/japan', contentDir)).toBe(false);
    expect(isKnownMissing('/japan/tokyo', contentDir)).toBe(false);
  });

  it('decides nothing when the config cannot be read', () => {
    mockConfig.mockReturnValue(null);
    expect(isKnownMissing('/contact', contentDir)).toBe(false);
  });

  it('knows paths deeper than the catch-all serves', () => {
    expect(isKnownMissing('/x/y/z', contentDir)).toBe(true);
    expect(isKnownMissing('/japan/tokyo/extra/', contentDir)).toBe(true);
    // Deep paths below a fixed route are that route's to answer.
    expect(isKnownMissing('/admin/settings/general', contentDir)).toBe(false);
    expect(isKnownMissing('/admin/journal/kyoto', contentDir)).toBe(false);
    expect(isKnownMissing('/proof/abc/def', contentDir)).toBe(false);
    // Next's internals and dotfiles are not the catch-all's either.
    expect(isKnownMissing('/_next/data/build/x.json', contentDir)).toBe(false);
    expect(isKnownMissing('/.well-known/appspecific/x.json', contentDir)).toBe(false);
  });

  it('lists every top-level route directory under app/', () => {
    // A route directory missing from the list would have its deep paths
    // answered 404 while the page renders normally.
    const appDir = path.join(process.cwd(), 'app');
    const hasRoute = (dir: string): boolean =>
      fs
        .readdirSync(dir, { withFileTypes: true })
        .some((entry) =>
          entry.isDirectory()
            ? hasRoute(path.join(dir, entry.name))
            : /^(page|route)\.(tsx?|jsx?)$/.test(entry.name),
        );
    // A route group such as app/(home) adds no URL segment: its children are
    // top-level routes themselves.
    const topLevelDirs = (dir: string): string[] =>
      fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== '[...path]')
        .flatMap((entry) =>
          /^\(.*\)$/.test(entry.name)
            ? topLevelDirs(path.join(dir, entry.name))
            : hasRoute(path.join(dir, entry.name))
              ? [entry.name]
              : [],
        );
    const routeDirs = topLevelDirs(appDir);
    expect(routeDirs.length).toBeGreaterThan(5);
    for (const name of routeDirs) expect(TOP_LEVEL_ROUTES.has(name), name).toBe(true);
  });

  /*
   * #704 answered with NextResponse.rewrite(request.nextUrl, { status: 404 }).
   * NextURL reports 127.0.0.1 as "localhost", so behind `next start -H
   * 127.0.0.1` the destination's origin no longer matched the server's and
   * Next proxied it as an external URL to localhost — ::1, where nothing
   * listened: a 30 s hang and a 500 for every known-missing path.
   */
  it.each(['/journal/nope', '/contact', '/x/y/z'])(
    'answers %s with a 404 on the same request, not a rewrite to another origin',
    (pathname) => {
      const res = proxy(new NextRequest(`http://127.0.0.1:3591${pathname}`));
      expect(res.status).toBe(404);
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
      // The page still gets its nonce, and the policy still matches it.
      const nonce = res.headers.get('x-middleware-request-x-nonce');
      expect(nonce).toBeTruthy();
      expect(res.headers.get('Content-Security-Policy')).toContain(`'nonce-${nonce}'`);
    },
  );

  it('makes proxy() answer 404 with the policy still set', () => {
    const res = proxy(new NextRequest('https://example.com/contact'));
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
    mockConfig.mockReturnValue(null);
    expect(proxy(new NextRequest('https://example.com/contact')).status).toBe(200);
  });
});
