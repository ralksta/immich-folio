import { describe, it, expect } from 'vitest';
import { nextSlideshowSpeed, SLIDESHOW_SPEEDS, type SlideshowSpeed } from '@/lib/slideshow';

describe('nextSlideshowSpeed', () => {
  it('cycles off → 3s → 5s → 10s → off', () => {
    expect(nextSlideshowSpeed(null)).toBe(3);
    expect(nextSlideshowSpeed(3)).toBe(5);
    expect(nextSlideshowSpeed(5)).toBe(10);
    expect(nextSlideshowSpeed(10)).toBeNull();
  });

  it('returns to off after one full cycle, so the key always lets go', () => {
    let speed: SlideshowSpeed = null;
    for (let i = 0; i < SLIDESHOW_SPEEDS.length; i++) speed = nextSlideshowSpeed(speed);
    expect(speed).toBeNull();
  });

  it('never yields a speed outside the advertised set', () => {
    let speed: SlideshowSpeed = null;
    for (let i = 0; i < 20; i++) {
      speed = nextSlideshowSpeed(speed);
      expect(SLIDESHOW_SPEEDS).toContain(speed);
    }
  });

  it('re-enters the cycle from an unrecognised value rather than sticking', () => {
    expect(nextSlideshowSpeed(7 as SlideshowSpeed)).toBe(3);
  });
});
