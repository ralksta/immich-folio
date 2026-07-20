import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

let mockHops = 0;
vi.mock('@/lib/config', () => ({
  getConfig: () => ({ trustedProxyHops: mockHops }),
}));

import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

function req(headers: Record<string, string>, ip?: string): NextRequest {
  return { ...(ip ? { ip } : {}), headers: new Headers(headers) } as unknown as NextRequest;
}

describe('getClientIp with no proxy configured (TRUSTED_PROXY_HOPS=0)', () => {
  beforeEach(() => {
    mockHops = 0;
  });

  it('prioritizes request.ip when the platform provides it', () => {
    expect(req({ 'x-real-ip': '5.6.7.8' }, '1.2.3.4')).toBeTruthy();
    expect(getClientIp(req({ 'x-real-ip': '5.6.7.8' }, '1.2.3.4'))).toBe('1.2.3.4');
  });

  it('falls back to headers on a best-effort basis', () => {
    expect(getClientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(getClientIp(req({ 'x-forwarded-for': '9.10.11.12, 13.14.15.16' }))).toBe('9.10.11.12');
  });

  it('returns unknown if no IP information is available at all', () => {
    expect(getClientIp(req({}))).toBe('unknown');
  });
});

describe('getClientIp behind one trusted proxy (TRUSTED_PROXY_HOPS=1, e.g. nginx)', () => {
  beforeEach(() => {
    mockHops = 1;
  });

  it('takes the rightmost X-Forwarded-For entry, which the proxy appended itself', () => {
    // nginx `$proxy_add_x_forwarded_for` appends the real peer address, so the
    // last entry is authoritative no matter what the client sent.
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('ignores client-supplied entries to the left of the appended one', () => {
    // The attacker sends `X-Forwarded-For: 1.1.1.1`; nginx appends their real IP.
    const spoofed = req({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' });
    expect(getClientIp(spoofed)).toBe('203.0.113.9');
  });

  it('cannot be pinned to an attacker-chosen bucket by a long forged chain', () => {
    const forged = req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.9' });
    expect(getClientIp(forged)).toBe('203.0.113.9');
  });

  it('does not trust a spoofed X-Real-IP over the appended X-Forwarded-For entry', () => {
    const spoofed = req({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9, 203.0.113.9' });
    expect(getClientIp(spoofed)).toBe('203.0.113.9');
  });

  it('accepts X-Real-IP when the proxy sets only that header (nginx overwrites it)', () => {
    expect(getClientIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('refuses to identify a request that did not traverse the proxy', () => {
    // No proxy headers at all, yet hops are configured: the request reached the
    // app directly. Fall back to unknown rather than to a spoofable value.
    expect(getClientIp(req({}))).toBe('unknown');
  });
});

describe('getClientIp behind two trusted proxies (TRUSTED_PROXY_HOPS=2)', () => {
  beforeEach(() => {
    mockHops = 2;
  });

  it('skips both proxy hops from the right', () => {
    const r = req({ 'x-forwarded-for': '203.0.113.9, 10.0.0.5' });
    expect(getClientIp(r)).toBe('203.0.113.9');
  });

  it('returns unknown when the chain is shorter than the configured hop count', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '10.0.0.5' }))).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  // Use unique IP prefixes per test to avoid cross-contamination
  let testIp: string;
  let counter = 0;

  beforeEach(() => {
    counter++;
    testIp = `test-ip-${counter}-${Date.now()}`;
  });

  it('allows the first request', () => {
    const result = checkRateLimit(testIp, 5);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('tracks remaining count correctly', () => {
    checkRateLimit(testIp, 5);
    const result = checkRateLimit(testIp, 5);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('blocks requests exceeding the limit', () => {
    const maxRpm = 3;
    checkRateLimit(testIp, maxRpm); // 1
    checkRateLimit(testIp, maxRpm); // 2
    checkRateLimit(testIp, maxRpm); // 3

    const result = checkRateLimit(testIp, maxRpm); // 4 — blocked
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks separate IPs independently', () => {
    const ip1 = `${testIp}-a`;
    const ip2 = `${testIp}-b`;

    checkRateLimit(ip1, 2);
    checkRateLimit(ip1, 2);
    const blocked = checkRateLimit(ip1, 2);
    expect(blocked.success).toBe(false);

    // ip2 should still be allowed
    const allowed = checkRateLimit(ip2, 2);
    expect(allowed.success).toBe(true);
    expect(allowed.remaining).toBe(1);
  });

  it('returns a future resetAt timestamp', () => {
    const before = Date.now();
    const result = checkRateLimit(testIp, 5);
    expect(result.resetAt).toBeGreaterThan(before);
    // Should be within ~60 seconds from now
    expect(result.resetAt).toBeLessThanOrEqual(before + 61_000);
  });

  it('does not crash when store is at capacity and allows new requests by evicting oldest entries', () => {
    // Fill the store beyond MAX_STORE_ENTRIES (10_000 in prod)
    // by hammering with unique IPs.
    const uniqueIps = Array.from({ length: 10005 }, (_, i) => `evict-test-ip-${i}-${Date.now()}`);
    for (const ip of uniqueIps) {
      checkRateLimit(ip, 5);
    }

    // A brand-new IP must be allowed by evicting the oldest entry
    const freshIp = `evict-fresh-${Date.now()}`;
    const result = checkRateLimit(freshIp, 5);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
