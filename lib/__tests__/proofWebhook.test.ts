import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildWebhookPayload, notifySubmitted, webhookUrl } from '../proofWebhook';
import type { ProofSession } from '../proofSessions';

const session: ProofSession = {
  id: 'abc123',
  token: 'x'.repeat(32),
  clientName: 'Anna & Ben',
  albumId: '11111111-1111-1111-1111-111111111111',
  createdAt: '2026-01-01T00:00:00Z',
  download: 'none',
  downloadsUsed: 0,
  selection: ['a', 'b'],
  submittedAt: '2026-02-01T00:00:00Z',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('webhookUrl', () => {
  it('accepts http(s) only', () => {
    expect(webhookUrl('https://ntfy.example/x')).toBe('https://ntfy.example/x');
    expect(webhookUrl('ftp://x')).toBeNull();
    expect(webhookUrl('not a url')).toBeNull();
    expect(webhookUrl('')).toBeNull();
  });
});

describe('buildWebhookPayload', () => {
  it('speaks Discord, Slack and Gotify at once, and never carries the client token', () => {
    const payload = buildWebhookPayload(session, 'Wedding', 'https://folio.example');
    expect(payload.content).toContain('Anna & Ben');
    expect(payload.text).toContain('2 photos');
    expect(payload.title).toBeTruthy();
    expect(payload.message).toContain('"Wedding"');
    expect(payload.proofing.adminUrl).toBe('https://folio.example/admin/proofing?session=abc123');
    expect(JSON.stringify(payload)).not.toContain(session.token);
  });

  it('works without a site URL', () => {
    expect(buildWebhookPayload(session, 'Wedding', null).proofing.adminUrl).toBeNull();
  });
});

describe('notifySubmitted', () => {
  it('does nothing without a URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await notifySubmitted(session, 'Wedding', null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts JSON to the configured URL', async () => {
    vi.stubEnv('PROOFING_WEBHOOK_URL', 'https://hooks.example/abc');
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    await notifySubmitted(session, 'Wedding', null);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.example/abc');
    expect(JSON.parse(init.body as string).event).toBe('proofing.submitted');
  });

  it('swallows a failing webhook', async () => {
    vi.stubEnv('PROOFING_WEBHOOK_URL', 'https://hooks.example/abc');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('down'))),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(notifySubmitted(session, 'Wedding', null)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
