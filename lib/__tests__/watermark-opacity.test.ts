import { describe, it, expect } from 'vitest';
import { resolveWatermarkOpacity, WATERMARK_DEFAULT_OPACITY } from '../config/schema';

/**
 * The lightbox used to divide `watermark.opacity` by 100 while both the docs
 * and the admin slider expressed it as a fraction, so a configured 0.9 rendered
 * as 0.009 — invisible (#508).
 */
describe('resolveWatermarkOpacity', () => {
  it('passes a documented fraction through unchanged', () => {
    expect(resolveWatermarkOpacity(0.5)).toBe(0.5);
    expect(resolveWatermarkOpacity(0.9)).toBe(0.9);
  });

  it('reads a value above 1 as a percentage', () => {
    expect(resolveWatermarkOpacity(90)).toBe(0.9);
    expect(resolveWatermarkOpacity(50)).toBe(0.5);
  });

  it('treats 1 as fully opaque, not as one percent', () => {
    expect(resolveWatermarkOpacity(1)).toBe(1);
  });

  it('clamps out-of-range values into 0–1', () => {
    expect(resolveWatermarkOpacity(400)).toBe(1);
    expect(resolveWatermarkOpacity(-2)).toBe(0);
  });

  it('falls back to the default when unset or not a number', () => {
    expect(resolveWatermarkOpacity(undefined)).toBe(WATERMARK_DEFAULT_OPACITY);
    expect(resolveWatermarkOpacity(NaN)).toBe(WATERMARK_DEFAULT_OPACITY);
  });

  it('keeps 0 as fully transparent rather than falling back', () => {
    expect(resolveWatermarkOpacity(0)).toBe(0);
  });
});
