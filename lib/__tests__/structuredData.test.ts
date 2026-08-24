import { describe, it, expect } from 'vitest';
import { albumStructuredData } from '@/lib/structuredData';

const base = {
  siteUrl: 'https://folio.example',
  pageUrl: 'https://folio.example/travel/iceland',
  albumName: 'Iceland',
};

describe('albumStructuredData', () => {
  it('describes the album as an ImageGallery', () => {
    const data = albumStructuredData(base)!;
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('ImageGallery');
    expect(data.name).toBe('Iceland');
    expect(data.url).toBe('https://folio.example/travel/iceland');
  });

  /**
   * Structured data is a set of claims about absolute URLs. Without one there
   * is nothing truthful to claim, so nothing is emitted.
   */
  it.each([
    ['no site URL', { ...base, siteUrl: null }],
    ['no page URL', { ...base, pageUrl: null }],
    ['a blank album name', { ...base, albumName: '   ' }],
  ])('emits nothing for %s', (_label, input) => {
    expect(albumStructuredData(input)).toBeNull();
  });

  it('omits optional fields rather than emitting empty ones', () => {
    const data = albumStructuredData(base)!;
    for (const key of ['description', 'creator', 'license', 'image', 'numberOfItems']) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it('carries creator and license when configured', () => {
    const data = albumStructuredData({
      ...base,
      creator: 'Jane Doe',
      license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    })!;
    expect(data.creator).toEqual({ '@type': 'Person', name: 'Jane Doe' });
    expect(data.license).toBe('https://creativecommons.org/licenses/by-nc/4.0/');
  });

  it('repeats creator and license on the cover image', () => {
    const data = albumStructuredData({
      ...base,
      coverUrl: 'https://folio.example/api/image/tok',
      creator: 'Jane Doe',
      license: 'CC BY-NC 4.0',
    })!;
    expect(data.image).toEqual({
      '@type': 'ImageObject',
      contentUrl: 'https://folio.example/api/image/tok',
      creator: { '@type': 'Person', name: 'Jane Doe' },
      license: 'CC BY-NC 4.0',
    });
  });

  it('treats blank creator and license as absent', () => {
    const data = albumStructuredData({ ...base, creator: '   ', license: '  ' })!;
    expect(data).not.toHaveProperty('creator');
    expect(data).not.toHaveProperty('license');
  });

  it('trims the values it does emit', () => {
    const data = albumStructuredData({
      ...base,
      albumName: '  Iceland  ',
      description: '  Winter light.  ',
      creator: '  Jane Doe  ',
    })!;
    expect(data.name).toBe('Iceland');
    expect(data.description).toBe('Winter light.');
    expect(data.creator).toEqual({ '@type': 'Person', name: 'Jane Doe' });
  });

  it('reports the photo count when given', () => {
    expect(albumStructuredData({ ...base, photoCount: 42 })!.numberOfItems).toBe(42);
    expect(albumStructuredData({ ...base, photoCount: 0 })!.numberOfItems).toBe(0);
  });

  it('survives JSON serialisation, which is how it is emitted', () => {
    const data = albumStructuredData({ ...base, creator: 'Jane Doe', photoCount: 3 })!;
    expect(() => JSON.parse(JSON.stringify(data))).not.toThrow();
  });
});
