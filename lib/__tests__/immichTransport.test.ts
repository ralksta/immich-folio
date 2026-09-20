import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestJson, ImmichUnavailableError, isTimeout } from '../immichTransport';

/**
 * The distinction these tests pin is the one that matters to visitors: `null`
 * means Immich answered and the thing is gone, an ImmichUnavailableError means
 * Immich could not answer at all. Conflating them once rendered every album URL
 * as a hard 404 during an outage — including albums that exist.
 */

const opts = {
  apiUrl: 'http://immich.test/api',
  apiKey: 'test-key',
  timeoutMs: 5000,
  endpoint: '/albums',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestJson', () => {
  it('returns the parsed body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([{ id: 'album-1' }])),
    );

    await expect(requestJson(opts)).resolves.toEqual([{ id: 'album-1' }]);
  });

  it('sends the API key and asks for JSON', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json([]));
    vi.stubGlobal('fetch', fetchMock);

    await requestJson(opts);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://immich.test/api/albums');
    expect(init).toBeDefined();
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ 'x-api-key': 'test-key', Accept: 'application/json' });
  });

  it('posts when given a body', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json([]));
    vi.stubGlobal('fetch', fetchMock);

    await requestJson({ ...opts, body: { albumId: 'a1' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"albumId":"a1"}');
  });

  it('returns null for a resource that is genuinely gone', async () => {
    for (const status of [404, 410]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status })),
      );

      await expect(requestJson(opts)).resolves.toBeNull();
    }
  });

  it('throws for a status that means "not right now"', async () => {
    // A 5xx, a rate limit or a rejected API key are outages, not deletions.
    for (const status of [401, 429, 500, 502, 503]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status, statusText: 'Nope' })),
      );

      await expect(requestJson(opts)).rejects.toBeInstanceOf(ImmichUnavailableError);
    }
  });

  it('carries the status on the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503, statusText: 'Unavailable' })),
    );

    await expect(requestJson(opts)).rejects.toMatchObject({ status: 503 });
  });

  it('refuses a non-JSON body', async () => {
    // We always send Accept: application/json, so an HTML body is a gateway
    // error page, not an answer about the resource.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>502 Bad Gateway</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );

    await expect(requestJson(opts)).rejects.toThrow(/non-JSON/);
  });

  it('reports a timeout as such, with the budget in the message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
      }),
    );

    await expect(requestJson(opts)).rejects.toThrow(/did not respond within 5000ms/);
  });

  it('reports an unreachable host separately from a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(requestJson(opts)).rejects.toThrow(/Cannot reach Immich/);
  });

  it('turns a malformed body into an outage rather than a crash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{ not json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(requestJson(opts)).rejects.toThrow(/malformed JSON/);
  });
});

describe('isTimeout', () => {
  it('recognises both ways of giving up waiting', () => {
    expect(isTimeout(Object.assign(new Error(''), { name: 'TimeoutError' }))).toBe(true);
    expect(isTimeout(Object.assign(new Error(''), { name: 'AbortError' }))).toBe(true);
    expect(isTimeout(new TypeError('fetch failed'))).toBe(false);
    expect(isTimeout('not an error')).toBe(false);
  });
});
