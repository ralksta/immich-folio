import { describe, it, expect } from 'vitest';
import { getImgProps } from 'next/dist/shared/lib/get-img-props';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import immichLoader from '../immichLoader';
import { canonicalImageUrl, resolveImageSize } from '../imageSize';

/**
 * The proxy answers every width inside an Immich tier with the same bytes, but
 * each distinct URL is its own `immutable` cache entry. next/image used to
 * write a different `?w=` into every srcset candidate and the lightbox asked
 * for the bare URL, so a grid tile and the same photo in the lightbox — or a
 * tile before and after a rotation — downloaded the identical preview twice.
 */

const PREVIEW = '/api/image/v2:tok?size=preview';
const THUMB = '/api/image/v2:tok?size=thumbnail';

const ALL_WIDTHS = [...imageConfigDefault.deviceSizes, ...imageConfigDefault.imageSizes];

function srcSetUrls(src: string, sizes: string): string[] {
  const { props } = getImgProps(
    { src, alt: '', fill: true, sizes },
    {
      defaultLoader: immichLoader,
      imgConf: { ...imageConfigDefault, loader: 'custom', loaderFile: './lib/immichLoader.ts' },
      showAltText: false,
      blurComplete: false,
    },
  );
  return (props.srcSet ?? '').split(', ').map((candidate) => candidate.split(' ')[0]);
}

const tierOf = (url: string) => {
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  return resolveImageSize(params.get('size'), params.get('w'));
};

describe('one image URL per asset and tier', () => {
  it.each([
    ['PhotoGrid', '(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw'],
    ['SubpageGridView', '(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw'],
    ['album hero', '100vw'],
    ['home hero', '(max-width: 640px) 100vw, 50vw'],
    ['essay', '(max-width: 1100px) 100vw, 1100px'],
  ])('every %s srcset candidate is the URL the lightbox opens', (_name, sizes) => {
    const urls = srcSetUrls(PREVIEW, sizes);
    expect(urls.length).toBeGreaterThan(3);
    expect(new Set(urls)).toEqual(new Set([canonicalImageUrl(PREVIEW)]));
  });

  it('collapses a thumbnail-ceiling image to one URL as well', () => {
    expect(new Set(srcSetUrls(THUMB, '25vw'))).toEqual(new Set([canonicalImageUrl(THUMB)]));
  });

  it('asks the proxy for the same rendition the raw width did', () => {
    for (const size of ['thumbnail', 'preview', 'original', null]) {
      const src = size ? `/api/image/v2:tok?size=${size}` : '/api/image/v2:tok';
      for (const w of [...ALL_WIDTHS, 1, 250, 251, 1440, 1441, 99999]) {
        expect(tierOf(canonicalImageUrl(src, w))).toBe(resolveImageSize(size, String(w)));
      }
    }
  });

  it('keeps the cache buster and writes a width next/image accepts', () => {
    expect(canonicalImageUrl('/api/image/v2:tok?size=preview&v=7', 640)).toBe(
      '/api/image/v2:tok?size=preview&v=7&w=1440',
    );
    expect(canonicalImageUrl('https://cdn.example.com/api/image/v2:tok?size=thumbnail', 96)).toBe(
      'https://cdn.example.com/api/image/v2:tok?size=thumbnail&w=250',
    );
    expect(immichLoader({ src: PREVIEW, width: 400 })).not.toBe(PREVIEW);
  });
});
