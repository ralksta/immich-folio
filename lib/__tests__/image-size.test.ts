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

  it('honours an explicit size on its own, up to the preview ceiling', () => {
    expect(resolveImageSize('thumbnail', null)).toBe('thumbnail');
    expect(resolveImageSize('preview', null)).toBe('preview');
  });

  it('falls back to the width-derived tier when no size is given', () => {
    expect(resolveImageSize(null, '128')).toBe('thumbnail');
    expect(resolveImageSize(null, '1000')).toBe('preview');
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

  /**
   * `/api/image` treats the opaque token as the whole capability check —
   * holding one means you saw the page it was rendered on. That is right for
   * a preview, not for the un-downsampled original: only `/api/download`
   * verifies the album allowlist, `download: true` and every password gate.
   * `?size=original` or a large `?w=` alone used to reach `original`
   * unopposed, since the smaller()-of-both-parameters check only ran when
   * both were present (GHSA-36m4-p39x-9wx8).
   */
  describe('never returns original, regardless of what is asked for', () => {
    it('caps an explicit ?size=original to preview', () => {
      expect(resolveImageSize('original', null)).toBe('preview');
    });

    it('caps a large ?w= alone to preview', () => {
      expect(resolveImageSize(null, '3840')).toBe('preview');
      expect(resolveImageSize(null, '1920')).toBe('preview');
    });

    it('caps the combination of size=original and a large width', () => {
      expect(resolveImageSize('original', '3840')).toBe('preview');
    });

    it('still narrows to thumbnail when the width says so', () => {
      // The cap is a ceiling, not a floor — a small width may still win.
      expect(resolveImageSize('original', '128')).toBe('thumbnail');
    });
  });
});
