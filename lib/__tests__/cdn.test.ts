import { describe, it, expect, vi, beforeEach } from 'vitest';

const config = { authSecret: 'test-auth-secret-32-chars-long-min', sitePassword: '' };

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
  getConfigOrNull: () => config,
}));

const ASSET = '11111111-1111-1111-1111-111111111111';

describe('normalizeCdnUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function normalize(raw: string | undefined) {
    const { normalizeCdnUrl } = await import('@/lib/env');
    return normalizeCdnUrl(raw);
  }

  it('keeps an https origin and drops the trailing slash', async () => {
    expect(await normalize('https://cdn.example.net/')).toBe('https://cdn.example.net');
  });

  it('keeps a path prefix', async () => {
    expect(await normalize(' https://cdn.example.net/folio// ')).toBe(
      'https://cdn.example.net/folio',
    );
  });

  it('rejects what cannot prefix a path', async () => {
    expect(await normalize('')).toBe('');
    expect(await normalize(undefined)).toBe('');
    expect(await normalize('cdn.example.net')).toBe('');
    expect(await normalize('ftp://cdn.example.net')).toBe('');
    expect(await normalize('https://cdn.example.net/?x=1')).toBe('');
    expect(await normalize('https://cdn.example.net/#top')).toBe('');
    expect(await normalize('https://user:pw@cdn.example.net')).toBe('');
  });
});

describe('CDN mode', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    config.sitePassword = '';
  });

  async function load() {
    const urls = await import('@/lib/urls');
    const cdn = await import('@/lib/cdn');
    return { ...urls, ...cdn };
  }

  it('keeps URLs relative without CDN_URL', async () => {
    const { imageUrl, videoUrl, cdnOrigin } = await load();
    expect(imageUrl(ASSET)).toMatch(/^\/api\/image\/[^?]+\?size=preview$/);
    expect(videoUrl(ASSET)).toMatch(/^\/api\/video\/[^?]+$/);
    expect(cdnOrigin()).toBeNull();
  });

  it('puts images and videos on the CDN', async () => {
    vi.stubEnv('CDN_URL', 'https://cdn.example.net/folio/');
    const { imageUrl, videoUrl, exifUrl, downloadUrl, cdnOrigin } = await load();

    expect(imageUrl(ASSET, 'thumbnail')).toMatch(
      /^https:\/\/cdn\.example\.net\/folio\/api\/image\/[^?]+\?size=thumbnail$/,
    );
    expect(videoUrl(ASSET)).toMatch(/^https:\/\/cdn\.example\.net\/folio\/api\/video\//);
    expect(cdnOrigin()).toBe('https://cdn.example.net');

    // Routes that check cookies or are not cacheable stay on this host.
    expect(exifUrl(ASSET)).toMatch(/^\/api\/exif\//);
    expect(downloadUrl('album', ASSET)).toMatch(/^\/api\/download\//);
  });

  it('keeps the cache buster on CDN URLs', async () => {
    vi.stubEnv('CDN_URL', 'https://cdn.example.net');
    vi.stubEnv('IMAGE_CACHE_VERSION', '7');
    const { imageUrl } = await load();
    expect(imageUrl(ASSET)).toMatch(/^https:\/\/cdn\.example\.net\/api\/image\/.+&v=7$/);
  });

  it('stays off while a site password is set, and follows it at runtime', async () => {
    vi.stubEnv('CDN_URL', 'https://cdn.example.net');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { imageUrl, cdnOrigin } = await load();

    config.sitePassword = 'secret';
    expect(imageUrl(ASSET)).toMatch(/^\/api\/image\//);
    // The policy still allows the origin; it just goes unused.
    expect(cdnOrigin()).toBe('https://cdn.example.net');
    expect(warn).toHaveBeenCalledTimes(1);

    config.sitePassword = '';
    expect(imageUrl(ASSET)).toMatch(/^https:\/\/cdn\.example\.net\/api\/image\//);
    warn.mockRestore();
  });

  it('ignores an invalid CDN_URL', async () => {
    vi.stubEnv('CDN_URL', 'not a url');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { imageUrl, cdnOrigin } = await load();
    expect(imageUrl(ASSET)).toMatch(/^\/api\/image\//);
    expect(cdnOrigin()).toBeNull();
    warn.mockRestore();
  });
});
