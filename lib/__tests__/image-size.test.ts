import { describe, it, expect } from 'vitest';
import { resolveImageSize, widthToSize } from '../imageSize';

describe('widthToSize', () => {
  it('maps widths to Immich tiers at the documented boundaries', () => {
    expect(widthToSize(250)).toBe('thumbnail');
    expect(widthToSize(251)).toBe('preview');
    expect(widthToSize(1440)).toBe('preview');
    expect(widthToSize(1441)).toBe('original');
  });
});

describe('resolveImageSize', () => {
  it('defaults to preview when neither parameter is given', () => {
    expect(resolveImageSize(null, null)).toBe('preview');
  });

  it('honours an explicit size on its own', () => {
    expect(resolveImageSize('thumbnail', null)).toBe('thumbnail');
    expect(resolveImageSize('original', null)).toBe('original');
  });

  it('falls back to the width-derived tier when no size is given', () => {
    expect(resolveImageSize(null, '128')).toBe('thumbnail');
    expect(resolveImageSize(null, '3840')).toBe('original');
  });

  it('ignores an unrecognised size rather than trusting it', () => {
    expect(resolveImageSize('enormous', null)).toBe('preview');
  });

  it('ignores a non-numeric or non-positive width', () => {
    expect(resolveImageSize('preview', 'abc')).toBe('preview');
    expect(resolveImageSize('preview', '0')).toBe('preview');
    expect(resolveImageSize('preview', '-100')).toBe('preview');
  });

  // The reason this function exists. ?size= is a ceiling; a width may lower the
  // tier but must never raise it.
  describe('when both are present, the smaller tier wins', () => {
    it('lets a small width narrow the requested size', () => {
      expect(resolveImageSize('preview', '128')).toBe('thumbnail');
    });

    // The regression this guards. next/image emits widths up to 3840 and
    // widthToSize(1920) is 'original' — letting width win would ship full-size
    // originals to every large display.
    it('never upgrades past the requested size', () => {
      expect(resolveImageSize('preview', '1920')).toBe('preview');
      expect(resolveImageSize('preview', '3840')).toBe('preview');
      expect(resolveImageSize('thumbnail', '3840')).toBe('thumbnail');
    });

    it('leaves the real grid case unchanged', () => {
      // lib/urls.ts writes ?size=preview; next/image's smallest vw-based
      // deviceSize is 640. This combination must stay on preview.
      expect(resolveImageSize('preview', '640')).toBe('preview');
    });
  });
});
