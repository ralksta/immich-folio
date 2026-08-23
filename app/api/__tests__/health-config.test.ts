import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The Dockerfile's HEALTHCHECK probes this route. A config that cannot be
 * parsed therefore used to restart the container in a loop — at exactly the
 * moment the app was still repairable through /admin, and when restarting
 * cannot fix a YAML typo anyway (#519).
 */
const configOrNull = vi.fn<() => object | null>(() => ({}));

vi.mock('@/lib/config', () => ({
  getConfigOrNull: () => configOrNull(),
}));

vi.mock('@/lib/env', () => ({ env: { RATE_LIMIT_RPM: 1500, TRUSTED_PROXY_HOPS: 0 } }));

vi.mock('@/lib/immich', () => ({
  immich: { ping: vi.fn(async () => true) },
}));

import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/health');

/**
 * The route caches Immich's answer for ten seconds in a module variable, so
 * each case needs its own module instance — otherwise the second test reads the
 * first one's verdict.
 */
async function route() {
  vi.resetModules();
  return (await import('../health/route')).GET;
}

beforeEach(() => {
  vi.clearAllMocks();
  configOrNull.mockReturnValue({});
});

describe('GET /api/health', () => {
  it('is healthy when the config parses and Immich answers', async () => {
    const res = await (await route())(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.config).toBe('ok');
  });

  it('stays healthy when the config cannot be parsed', async () => {
    configOrNull.mockReturnValue(null);

    const res = await (await route())(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('setup');
    expect(body.config).toBe('invalid');
  });

  /** Immich being down is a real degradation and keeps its 503. */
  it('still reports 503 when Immich is unreachable', async () => {
    const GET = await route();
    const { immich } = await import('@/lib/immich');
    (immich.ping as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await GET(req());

    expect(res.status).toBe(503);
  });
});
