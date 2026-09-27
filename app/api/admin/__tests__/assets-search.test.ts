import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: () => true,
  isAdminAuthenticated: async () => true,
  COOKIE_NAME: 'folio_admin_session',
}));

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(() => ({
    needsCredentials: false,
    immich: { apiUrl: 'http://immich.test/api', apiKey: 'key' },
  })),
}));

import { GET } from '../assets/route';

type Item = { id: string; originalFileName: string; fileCreatedAt: string; isFavorite: boolean };
const item = (id: string): Item => ({
  id,
  originalFileName: `${id}.jpg`,
  fileCreatedAt: '2024-05-17T10:00:00.000Z',
  isFavorite: false,
});

let fetchMock: ReturnType<typeof vi.fn>;
const bodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

function respond(...pages: Array<{ items: Item[]; nextPage: string | null }>) {
  for (const p of pages) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ assets: p }), { status: 200 }));
  }
}

async function get(query: string) {
  const res = await GET(new NextRequest(`http://localhost/api/admin/assets?${query}`));
  return { status: res.status, body: await res.json() };
}

describe('GET /api/admin/assets — search (#602)', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('browses without a query in one Immich call', async () => {
    respond({ items: [item('a')], nextPage: '2' });
    const { status, body } = await get('page=1&favorites=true');
    expect(status).toBe(200);
    expect(body).toEqual({ assets: [item('a')], nextPage: 2 });
    expect(bodies()).toEqual([expect.objectContaining({ page: 1, isFavorite: true })]);
    expect(bodies()[0]).not.toHaveProperty('originalFileName');
  });

  it('searches filename and description and merges without duplicates', async () => {
    respond(
      { items: [item('a'), item('b')], nextPage: null },
      { items: [item('b'), item('c')], nextPage: '2' },
    );
    const { body } = await get('page=1&q=%20harbour%20');
    expect(bodies()).toEqual([
      expect.objectContaining({ originalFileName: 'harbour' }),
      expect.objectContaining({ description: 'harbour' }),
    ]);
    expect(body.assets.map((a: Item) => a.id)).toEqual(['a', 'b', 'c']);
    expect(body.nextPage).toBe(2);
  });

  it.each([
    ['2024', '2024-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'],
    ['2024-02', '2024-02-01T00:00:00.000Z', '2024-03-01T00:00:00.000Z'],
    ['2024-02-29', '2024-02-29T00:00:00.000Z', '2024-03-01T00:00:00.000Z'],
  ])('treats %s as a taken-date range', async (q, after, before) => {
    respond({ items: [], nextPage: null });
    await get(`q=${q}`);
    expect(bodies()).toEqual([expect.objectContaining({ takenAfter: after, takenBefore: before })]);
  });

  it('falls back to text search for an impossible date', async () => {
    respond({ items: [], nextPage: null }, { items: [], nextPage: null });
    await get('q=2023-02-29');
    expect(bodies()[0]).toMatchObject({ originalFileName: '2023-02-29' });
  });

  it.each(['0', '-1', 'abc', '1.5', '99999', '1e3'])('rejects page=%s', async (page) => {
    const { status } = await get(`page=${page}`);
    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an overlong query before calling Immich', async () => {
    const { status } = await get(`q=${'x'.repeat(101)}`);
    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an Immich error to 502', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const { status } = await get('q=x');
    expect(status).toBe(502);
  });
});
