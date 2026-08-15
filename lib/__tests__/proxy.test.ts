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

import { isSiteUnlocked } from '@/lib/auth';
import { proxy, config } from '@/proxy';

const mockUnlocked = isSiteUnlocked as unknown as ReturnType<typeof vi.fn>;

// Next.js 16 renamed the "middleware" file convention to "proxy": the file must
// be proxy.ts and must export proxy(), not middleware(). A silent regression here
// (wrong filename, wrong export name) means Next.js never invokes this code and
// every document response ships without a CSP — with no build error to catch it.
describe('proxy', () => {
  const run = (pathname = '/') => proxy(new NextRequest(`https://example.com${pathname}`));

  beforeEach(() => {
    mockUnlocked.mockReturnValue(true);
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
