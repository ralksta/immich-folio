import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const config = {
  contact: {
    enabled: true,
    retentionDays: 90,
    notifyUrl: '',
  },
  siteUrl: '',
};

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
  getConfigOrNull: () => config,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ success: true, resetAt: Date.now() + 60000 }),
  getClientIp: () => '127.0.0.1',
  retryAfterSeconds: () => 60,
}));

vi.mock('@/lib/contact', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/contact')>();
  return {
    ...actual,
    saveMessage: vi.fn(async () => ({ id: '123' })),
    notifyNewMessage: vi.fn(async () => {}),
  };
});

const { POST } = await import('../route');

function send(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/contact (#904)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers a stamp older than 24h with 409 Expired instead of silent success', async () => {
    const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
    const res = await send({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Hello',
      startedAt: twentyFiveHoursAgo,
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Expired' });
  });

  it('keeps silent success for real bot signals like honeypot or too-fast fill', async () => {
    const honeypotRes = await send({
      name: 'Bot',
      email: 'bot@example.com',
      message: 'Spam',
      website: 'http://spam.example',
      startedAt: Date.now() - 10000,
    });
    expect(honeypotRes.status).toBe(200);
    expect(await honeypotRes.json()).toEqual({ ok: true });

    const tooFastRes = await send({
      name: 'Bot',
      email: 'bot@example.com',
      message: 'Spam',
      startedAt: Date.now() - 50,
    });
    expect(tooFastRes.status).toBe(200);
    expect(await tooFastRes.json()).toEqual({ ok: true });
  });

  it('saves and answers 200 ok for valid submissions', async () => {
    const res = await send({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Real enquiry',
      startedAt: Date.now() - 10000,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
