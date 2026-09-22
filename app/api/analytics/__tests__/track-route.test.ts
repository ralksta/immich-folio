import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * POST /api/analytics/track had none of the safeguards every comparable route
 * has: no rate limit, an unbounded key space (`pagePath` straight from the
 * request body becomes a permanent object key), and a plain `fs.writeFile`
 * that a process killed mid-write truncates — which the next read then
 * silently resets to zero (GHSA-w293-x8pc-j4cv).
 */

vi.mock('@/lib/config', () => ({
  getConfigOrNull: vi.fn(() => ({ analytics: true })),
}));

const checkRateLimit = vi.fn(
  (_ip: string, _maxRpm: number): { success: boolean; remaining: number; resetAt: number } => ({
    success: true,
    remaining: 59,
    resetAt: 0,
  }),
);
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (ip: string, maxRpm: number) => checkRateLimit(ip, maxRpm),
  getClientIp: vi.fn(() => '127.0.0.1'),
  retryAfterSeconds: vi.fn(() => 60),
}));

const atomicWrite = vi.fn(async (_filePath: string, _content: string): Promise<void> => undefined);
vi.mock('@/lib/atomicWrite', () => ({
  atomicWrite: (filePath: string, content: string) => atomicWrite(filePath, content),
}));

let fixtureAnalytics: unknown = null;
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => {
      if (fixtureAnalytics === null) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return JSON.stringify(fixtureAnalytics);
    }),
    mkdir: vi.fn(async () => undefined),
  },
}));

import { POST } from '../track/route';
import { getConfigOrNull } from '@/lib/config';

const mockConfig = getConfigOrNull as unknown as ReturnType<typeof vi.fn>;

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
    }) as never,
  );

const savedData = () => {
  const call = atomicWrite.mock.calls.at(-1);
  return JSON.parse(String(call?.[1]));
};

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ success: true, remaining: 59, resetAt: 0 });
  mockConfig.mockReturnValue({ analytics: true });
  fixtureAnalytics = null;
});

describe('POST /api/analytics/track', () => {
  it('records a pageview and writes through atomicWrite, not a raw write', async () => {
    const res = await post({ path: '/deutschland/kloster-chorin' });
    expect(res.status).toBe(200);

    expect(atomicWrite).toHaveBeenCalledOnce();
    const data = savedData();
    expect(data.summary.totalViews).toBe(1);
    const [dateKey] = Object.keys(data.days);
    expect(data.days[dateKey].pages['/deutschland/kloster-chorin']).toBe(1);
  });

  it('is rate-limited per IP', async () => {
    checkRateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await post({ path: '/' });

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(atomicWrite).not.toHaveBeenCalled();
  });

  it('truncates a path far longer than any real route', async () => {
    const huge = '/' + 'a'.repeat(1000);
    await post({ path: huge });

    const data = savedData();
    const [dateKey] = Object.keys(data.days);
    const keys = Object.keys(data.days[dateKey].pages);
    expect(keys).toHaveLength(1);
    expect(keys[0].length).toBeLessThanOrEqual(200);
  });

  it('drops the query string from the path', async () => {
    await post({ path: '/journal?utm_source=newsletter' });

    const data = savedData();
    const [dateKey] = Object.keys(data.days);
    expect(Object.keys(data.days[dateKey].pages)).toEqual(['/journal']);
  });

  it('caps distinct page keys per day without dropping the pageview itself', async () => {
    const dateKey = new Date().toISOString().split('T')[0];
    const pages: Record<string, number> = {};
    for (let i = 0; i < 500; i++) pages[`/existing-${i}`] = 1;
    fixtureAnalytics = {
      summary: { totalViews: 500, lastUpdated: '' },
      days: { [dateKey]: { pageviews: 500, pages, devices: {} } },
    };

    const res = await post({ path: '/one-path-too-many' });
    expect(res.status).toBe(200);

    const data = savedData();
    // The day's total still counts this visit...
    expect(data.days[dateKey].pageviews).toBe(501);
    // ...but the 501st distinct path did not get its own key.
    expect(Object.keys(data.days[dateKey].pages)).toHaveLength(500);
    expect(data.days[dateKey].pages['/one-path-too-many']).toBeUndefined();
  });

  it('still increments an already-tracked path past the cap', async () => {
    const dateKey = new Date().toISOString().split('T')[0];
    const pages: Record<string, number> = { '/journal': 10 };
    for (let i = 0; i < 500; i++) pages[`/existing-${i}`] = 1;
    fixtureAnalytics = {
      summary: { totalViews: 510, lastUpdated: '' },
      days: { [dateKey]: { pageviews: 510, pages, devices: {} } },
    };

    await post({ path: '/journal' });

    const data = savedData();
    expect(data.days[dateKey].pages['/journal']).toBe(11);
  });

  it('does nothing when analytics are disabled', async () => {
    mockConfig.mockReturnValue({ analytics: false });

    const res = await post({ path: '/' });
    const body = await res.json();

    expect(body.trackingDisabled).toBe(true);
    expect(atomicWrite).not.toHaveBeenCalled();
  });
});
