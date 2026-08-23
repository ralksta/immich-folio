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

vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    needsCredentials: true,
    trustedProxyHops: 0,
    authSecret: 'x'.repeat(64),
    albums: [],
    subpages: [],
    albumPasswords: {},
    sitePassword: '',
    immich: { apiUrl: '', apiKey: '' },
    immichTimeoutMs: 1000,
  }),
}));

vi.mock('@/lib/env', () => ({ env: { AUTH_SECRET: 'x'.repeat(64) } }));
vi.mock('@/lib/admin/journal-service', () => ({ listJournalEntries: async () => [] }));

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
