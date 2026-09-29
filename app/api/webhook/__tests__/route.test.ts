import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

/**
 * The webhook is reachable by anyone, and the body has to be read before its
 * HMAC can be checked. The read is therefore capped: a declared length over
 * the cap is refused without touching the stream, and a body that turns out
 * longer than declared (or declares nothing, as a chunked one does) is cut off
 * at the cap. The signature must be exactly the hex digest of the raw bytes.
 */

const SECRET = 'test-webhook-secret';

const env = vi.hoisted(() => ({ WEBHOOK_SECRET: '' as string | undefined }));
vi.mock('@/lib/env', () => ({ env }));
vi.mock('@/lib/immich', () => ({
  immich: { invalidateAlbum: vi.fn(), invalidateAll: vi.fn() },
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

import { POST } from '../route';
import { immich } from '@/lib/immich';

const URL = 'http://localhost/api/webhook';
const CAP = 64 * 1024;

function sign(body: string | Uint8Array): string {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

function post(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/**
 * A request whose body is a lazily produced stream of `chunks` chunks of
 * `size` bytes each. `pulls()` reports how many chunks the route asked for.
 */
function streamed(chunks: number, size: number, headers: Record<string, string> = {}) {
  let pulled = 0;
  const chunk = new Uint8Array(size).fill(0x20); // spaces: valid JSON whitespace
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= chunks) {
        controller.close();
        return;
      }
      pulled++;
      controller.enqueue(chunk);
    },
  });
  const request = new NextRequest(URL, {
    method: 'POST',
    body,
    headers,
    duplex: 'half', // undici requires it for a stream body
  });
  return { request, pulls: () => pulled };
}

beforeEach(() => {
  vi.clearAllMocks();
  env.WEBHOOK_SECRET = SECRET;
});

describe('POST /api/webhook', () => {
  it('answers 501 when WEBHOOK_SECRET is unset, before looking at the size', async () => {
    env.WEBHOOK_SECRET = undefined;
    const { request } = streamed(1, 16, { 'content-length': String(CAP * 10) });
    const res = await POST(request);
    expect(res.status).toBe(501);
    expect(request.bodyUsed).toBe(false);
  });

  it('refuses an oversized Content-Length with 413 without reading the body', async () => {
    const { request } = streamed(1, 16, {
      'content-length': String(CAP + 1),
      'x-immich-signature': 'a'.repeat(64),
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
    expect(request.bodyUsed).toBe(false);
  });

  it('cuts off a chunked body over the cap, even with a valid signature', async () => {
    // 100 chunks of 1 KiB = 100 KiB; the whole body is signed correctly, so
    // only the size cap can turn it away.
    const size = 1024;
    const chunks = 100;
    const full = ' '.repeat(size * chunks);
    const { request, pulls } = streamed(chunks, size, { 'x-immich-signature': sign(full) });
    expect(request.headers.get('content-length')).toBeNull();

    const res = await POST(request);
    expect(res.status).toBe(413);
    expect(pulls()).toBeLessThan(chunks);
    expect(immich.invalidateAll).not.toHaveBeenCalled();
  });

  it('accepts a correctly signed payload under the cap', async () => {
    const body = JSON.stringify({ event: 'album.updated', albumId: 'album-1' });
    const res = await POST(post(body, { 'x-immich-signature': sign(body) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, invalidated: 'album-1' });
    expect(immich.invalidateAlbum).toHaveBeenCalledWith('album-1');
  });

  it('verifies the signature over the raw bytes, byte-order mark included', async () => {
    const json = JSON.stringify({ event: 'album.updated', albumId: 'album-1' });
    const raw = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json)]);
    const res = await POST(
      new NextRequest(URL, {
        method: 'POST',
        body: raw,
        headers: { 'x-immich-signature': sign(raw) },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('answers 401 for a wrong signature', async () => {
    const body = JSON.stringify({ event: 'album.updated', albumId: 'album-1' });
    const res = await POST(post(body, { 'x-immich-signature': sign('something else') }));
    expect(res.status).toBe(401);
    expect(immich.invalidateAlbum).not.toHaveBeenCalled();
  });

  it('answers 401 for a missing signature', async () => {
    const res = await POST(post('{"event":"x"}'));
    expect(res.status).toBe(401);
  });

  it.each([
    ['trailing non-hex characters', (sig: string) => `${sig}zz`],
    ['a trailing odd nibble', (sig: string) => `${sig}0`],
    ['an over-long digest', (sig: string) => sig.repeat(4)],
    ['non-hex characters', () => 'z'.repeat(64)],
  ])('answers 401 for a signature with %s', async (_label, mangle) => {
    const body = JSON.stringify({ event: 'album.updated', albumId: 'album-1' });
    const res = await POST(post(body, { 'x-immich-signature': mangle(sign(body)) }));
    expect(res.status).toBe(401);
    expect(immich.invalidateAlbum).not.toHaveBeenCalled();
  });
});
