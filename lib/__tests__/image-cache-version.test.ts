import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config', () => ({
  getConfig: () => ({ authSecret: 'test-auth-secret-32-chars-long-min' }),
}));

const ASSET = '11111111-1111-1111-1111-111111111111';

/**
 * Image responses are served `immutable` for a year, so the browser never
 * revalidates — the ETag is not even consulted. The URL is the only thing that
 * can invalidate a browser cache, which is why the buster lives there and not
 * only in the ETag. Immich regenerates thumbnails when a job is re-run or a
 * photo is rotated, and the asset ID does not change, so nothing else would.
 */
describe('IMAGE_CACHE_VERSION', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function urls() {
    const { imageUrl, videoUrl } = await import('@/lib/urls');
    return { imageUrl, videoUrl };
  }

  it('leaves URLs byte-identical when unset — the default must not change', async () => {
    const { imageUrl, videoUrl } = await urls();

    expect(imageUrl(ASSET)).toMatch(/^\/api\/image\/[^?]+\?size=preview$/);
    expect(imageUrl(ASSET, 'thumbnail')).toMatch(/^\/api\/image\/[^?]+\?size=thumbnail$/);
    expect(videoUrl(ASSET)).toMatch(/^\/api\/video\/[^?]+$/);
  });

  it('treats an empty or whitespace-only value as unset', async () => {
    vi.stubEnv('IMAGE_CACHE_VERSION', '   ');
    const { imageUrl } = await urls();
    expect(imageUrl(ASSET)).not.toContain('v=');
  });

  it('appends the version to image URLs when set', async () => {
    vi.stubEnv('IMAGE_CACHE_VERSION', '2');
    const { imageUrl } = await urls();
    expect(imageUrl(ASSET)).toMatch(/\?size=preview&v=2$/);
  });

  it('uses a leading ? on video URLs, which carry no other parameter', async () => {
    vi.stubEnv('IMAGE_CACHE_VERSION', '2');
    const { videoUrl } = await urls();

    const url = videoUrl(ASSET);
    expect(url).toMatch(/\?v=2$/);
    expect(url).not.toContain('?&');
  });

  it('escapes a value that would otherwise break the query string', async () => {
    vi.stubEnv('IMAGE_CACHE_VERSION', 'a b&c=d');
    const { imageUrl } = await urls();

    const url = imageUrl(ASSET);
    expect(url).toContain('v=a%20b%26c%3Dd');
    // One '&' only — the separator. An unescaped value would inject parameters.
    expect(url.split('&')).toHaveLength(2);
  });

  it('changes the URL when bumped, which is the entire point', async () => {
    vi.stubEnv('IMAGE_CACHE_VERSION', '1');
    const before = (await urls()).imageUrl(ASSET);

    vi.resetModules();
    vi.stubEnv('IMAGE_CACHE_VERSION', '2');
    const after = (await urls()).imageUrl(ASSET);

    expect(after).not.toBe(before);
    // The token itself is unchanged: same asset, same encryption, new cache key.
    expect(after.split('?')[0]).toBe(before.split('?')[0]);
  });
});
