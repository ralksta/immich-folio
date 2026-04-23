import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

describe('getClientIp', () => {
  it('prioritizes request.ip when present', () => {
    const req = {
      ip: '1.2.3.4',
      headers: new Headers({
        'x-real-ip': '5.6.7.8',
        'x-forwarded-for': '9.10.11.12',
      }),
    } as unknown as NextRequest;

    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip if request.ip is missing', () => {
    const req = {
      headers: new Headers({
        'x-real-ip': '5.6.7.8',
        'x-forwarded-for': '9.10.11.12',
      }),
    } as unknown as NextRequest;

    expect(getClientIp(req)).toBe('5.6.7.8');
  });

  it('falls back to x-forwarded-for if request.ip and x-real-ip are missing', () => {
    const req = {
      headers: new Headers({
        'x-forwarded-for': '9.10.11.12, 13.14.15.16',
      }),
    } as unknown as NextRequest;

    // Should take the first IP from x-forwarded-for list
    expect(getClientIp(req)).toBe('9.10.11.12');
  });

  it('returns unknown if no IP headers are present', () => {
    const req = {
      headers: new Headers(),
    } as unknown as NextRequest;

    expect(getClientIp(req)).toBe('unknown');
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
