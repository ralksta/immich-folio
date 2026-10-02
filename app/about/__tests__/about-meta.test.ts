import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * P-17: /about shared with no picture. A page's openGraph replaces the
 * layout's whole, so leaving `images` out dropped the site card too.
 */

let aboutMd = '';

vi.mock('fs', async (orig) => {
  const actual = await orig<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: async (path: string, enc: string) =>
        String(path).endsWith('about.md')
          ? aboutMd
          : actual.promises.readFile(path, enc as 'utf-8'),
    },
  };
});
vi.mock('@/lib/config', () => ({
  getConfig: () => ({ authSecret: 'test-secret', aboutEnabled: true }),
  getConfigOrNull: () => ({ lang: 'en' }),
}));
vi.mock('@/lib/urls', () => ({
  imageUrl: (ref: string | { id: string; isEdited?: boolean }, size: string) =>
    typeof ref === 'string'
      ? `/api/image/tok-${ref}?size=${size}`
      : `/api/image/tok-${ref.id}?size=${size}${ref.isEdited ? '&e=edit' : ''}`,
  assetPlaceholder: () => null,
}));
const portraitAsset = vi.hoisted(() => ({ value: null as null | Record<string, unknown> }));
vi.mock('@/lib/immich', () => ({
  immich: { getAssetInfo: async () => portraitAsset.value },
}));

const { generateMetadata } = await import('../page');

describe('/about metadata', () => {
  beforeEach(() => {
    aboutMd = '';
    portraitAsset.value = null;
  });

  it('shares a portrait edited in Immich under its edited URL (#831)', async () => {
    aboutMd = '---\nname: Ada\nportrait: portrait-uuid\n---\nHello.';
    portraitAsset.value = { id: 'portrait-uuid', isEdited: true };
    const m = await generateMetadata();
    expect(m.openGraph?.images).toEqual(['/api/image/tok-portrait-uuid?size=preview&e=edit']);
  });

  it('uses the portrait as the share image', async () => {
    aboutMd = '---\nname: Ada\nportrait: portrait-uuid\n---\nHello.';
    const m = await generateMetadata();
    expect(m.openGraph?.images).toEqual(['/api/image/tok-portrait-uuid?size=preview']);
    expect(m.twitter?.images).toEqual(['/api/image/tok-portrait-uuid?size=preview']);
  });

  it('falls back to the generated card without a portrait', async () => {
    aboutMd = '---\nname: Ada\n---\nHello.';
    const m = await generateMetadata();
    const [image] = m.openGraph?.images as string[];
    expect(image).toMatch(/^\/api\/og\?/);
    expect(new URL(image, 'https://x.test').searchParams.get('title')).toBe(m.title);
  });
});
