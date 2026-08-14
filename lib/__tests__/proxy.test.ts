import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config } from '@/proxy';

// Next.js 16 renamed the "middleware" file convention to "proxy": the file must
// be proxy.ts and must export proxy(), not middleware(). A silent regression here
// (wrong filename, wrong export name) means Next.js never invokes this code and
// every document response ships without a CSP — with no build error to catch it.
describe('proxy', () => {
  const run = (pathname = '/') => proxy(new NextRequest(`https://example.com${pathname}`));

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
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      expect(run().headers.get('Content-Security-Policy')).toContain("'unsafe-eval'");
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('omits unsafe-eval in production/test environments', () => {
    expect(run().headers.get('Content-Security-Policy')).not.toContain("'unsafe-eval'");
  });

  it('keeps a matcher that excludes api and static assets but covers /admin', () => {
    const source = config.matcher[0].source;
    expect(source).toContain('api');
    expect(source).toContain('_next/static');
    expect(source).not.toContain('admin');
  });
});
