import { describe, it, expect } from 'vitest';
import { resolveExifDisplay, hasExifPanelContent } from '../config/schema';

describe('resolveExifDisplay', () => {
  it('shows everything when nothing is configured', () => {
    expect(resolveExifDisplay()).toEqual({
      camera: true,
      settings: true,
      location: true,
      caption: true,
      onHover: true,
    });
  });

  /**
   * `exifOnHover: false` meant "no technical EXIF anywhere" long before the
   * groups existed. Existing configs must keep that meaning.
   */
  it('keeps the old exifOnHover switch meaning what it did', () => {
    expect(resolveExifDisplay(undefined, false)).toMatchObject({
      camera: false,
      settings: false,
      location: false,
      onHover: false,
    });
  });

  /**
   * The description was served regardless of that switch, so a site that only
   * ever set `exifOnHover: false` must not lose its captions on upgrade — it
   * never had them switched off (#506).
   */
  it('does not let the old switch turn captions off', () => {
    expect(resolveExifDisplay(undefined, false).caption).toBe(true);
  });

  it('lets an explicit group win over the old switch', () => {
    const exif = resolveExifDisplay({ camera: true, caption: false }, false);

    expect(exif.camera).toBe(true);
    expect(exif.caption).toBe(false);
    // Unmentioned groups still follow the switch.
    expect(exif.location).toBe(false);
    // …and the switch still decides the hover overlay.
    expect(exif.onHover).toBe(false);
  });

  it('can hide only the location and the caption', () => {
    expect(resolveExifDisplay({ location: false, caption: false })).toEqual({
      camera: true,
      settings: true,
      location: false,
      caption: false,
      onHover: true,
    });
  });
});

describe('hasExifPanelContent', () => {
  it('is false only when every group is off', () => {
    const off = resolveExifDisplay({
      camera: false,
      settings: false,
      location: false,
      caption: false,
    });

    expect(hasExifPanelContent(off)).toBe(false);
  });

  it('stays true while one group survives', () => {
    const captionOnly = resolveExifDisplay({
      camera: false,
      settings: false,
      location: false,
      caption: true,
    });

    expect(hasExifPanelContent(captionOnly)).toBe(true);
  });

  /** The hover overlay is a separate switch and must not keep the panel alive. */
  it('ignores the hover overlay switch', () => {
    const hoverOnly = resolveExifDisplay(
      { camera: false, settings: false, location: false, caption: false },
      true,
    );

    expect(hoverOnly.onHover).toBe(true);
    expect(hasExifPanelContent(hoverOnly)).toBe(false);
  });
});
