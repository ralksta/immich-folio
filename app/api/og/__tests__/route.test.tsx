import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ReactNode } from 'react';

/**
 * The share card prints its URL's text on the site's own domain. Only text
 * the site signed itself (lib/ogImage.ts) may reach it; any other URL gets the
 * plain site card.
 */

const config = {
  authSecret: 'test-secret-that-is-at-least-32-chars-long',
  siteTitle: 'Jane Doe Photography',
  theme: { accent: '#e60012' },
  sitePassword: undefined,
};

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
  getConfigOrNull: () => config,
}));

let rendered: ReactNode = null;
vi.mock('next/og', () => ({
  ImageResponse: class {
    status = 200;
    constructor(element: ReactNode) {
      rendered = element;
    }
  },
}));

const { GET } = await import('../route');
const { ogImageUrl } = await import('@/lib/ogImage');

/** Every non-empty string in the rendered card, in order. */
function textOf(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (node === '') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return [];
}

async function cardText(path: string): Promise<string[]> {
  rendered = null;
  const res = await GET(new NextRequest(`http://localhost${path}`) as never);
  expect(res.status).toBe(200);
  return textOf(rendered);
}

describe('GET /api/og', () => {
  it('renders text the site signed', async () => {
    const text = await cardText(ogImageUrl('Iceland 2024', '42 photos'));
    expect(text).toEqual(['Iceland 2024', '42 photos']);
  });

  it('ignores an unsigned title and shows the site title', async () => {
    const text = await cardText(
      `/api/og?title=${encodeURIComponent('Your account is locked — call +1 555 0100')}`,
    );
    expect(text).toEqual(['Jane Doe Photography']);
  });

  it('ignores text whose signature belongs to other text', async () => {
    const url = new URL(ogImageUrl('Iceland 2024', '42 photos'), 'http://localhost');
    url.searchParams.set('subtitle', 'send your password to evil.example');
    const text = await cardText(url.pathname + url.search);
    expect(text).toEqual(['Jane Doe Photography']);
  });

  it('keeps a signature intact across non-ASCII text and truncation', async () => {
    const long = '家族相册 🏔️ '.repeat(40);
    const text = await cardText(ogImageUrl(long));
    expect(text).toHaveLength(1);
    expect(text[0]).not.toBe('Jane Doe Photography');
    expect(Array.from(text[0]).length).toBe(200);
  });
});
