import { describe, it, expect } from 'vitest';
import { localDateKey, dayNumber, photoOfTheDayIndex, photoOfTheDay } from '@/lib/photoOfTheDay';

describe('localDateKey', () => {
  it('formats the local calendar day, zero-padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 13, 30))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  /**
   * The bug this guards: toISOString() would answer in UTC, so late-evening
   * local time east of Greenwich — or early morning west of it — would report
   * the wrong day and roll the photo over at the wrong moment.
   */
  it('uses local fields, not UTC', () => {
    const lateEvening = new Date(2026, 5, 30, 23, 30);
    expect(localDateKey(lateEvening)).toBe('2026-06-30');
  });
});

describe('dayNumber', () => {
  it('counts days from the epoch', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
  });

  it('advances by exactly one per calendar day across a month boundary', () => {
    expect(dayNumber('2026-03-01')! - dayNumber('2026-02-28')!).toBe(1);
  });

  it('handles a leap day', () => {
    expect(dayNumber('2024-03-01')! - dayNumber('2024-02-29')!).toBe(1);
    expect(dayNumber('2024-02-29')).not.toBeNull();
  });

  it.each([
    ['empty', ''],
    ['not a date', 'tomorrow'],
    ['wrong separators', '2026/01/05'],
    ['unpadded', '2026-1-5'],
    ['month 13', '2026-13-01'],
    ['day 32', '2026-01-32'],
    ['29 February in a common year', '2025-02-29'],
  ])('rejects %s', (_label, key) => {
    expect(dayNumber(key)).toBeNull();
  });
});

describe('photoOfTheDayIndex', () => {
  it('changes every day and never repeats until the list is exhausted', () => {
    const count = 5;
    const seen = [0, 1, 2, 3, 4].map((offset) => {
      const date = new Date(Date.UTC(2026, 0, 1 + offset));
      return photoOfTheDayIndex(count, localDateKeyUtc(date));
    });
    expect(new Set(seen).size).toBe(count);
  });

  it('is stable for the same day', () => {
    expect(photoOfTheDayIndex(7, '2026-08-24')).toBe(photoOfTheDayIndex(7, '2026-08-24'));
  });

  it('stays in range', () => {
    for (const day of ['1970-01-01', '2026-08-24', '2099-12-31']) {
      const index = photoOfTheDayIndex(3, day);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }
  });

  it('stays in range before the epoch, where the modulo would go negative', () => {
    const index = photoOfTheDayIndex(3, '1969-01-01');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(3);
  });

  it('returns 0 for a single image or none', () => {
    expect(photoOfTheDayIndex(1, '2026-08-24')).toBe(0);
    expect(photoOfTheDayIndex(0, '2026-08-24')).toBe(0);
  });

  it('falls back to the first image on an unparseable date', () => {
    expect(photoOfTheDayIndex(5, 'not-a-date')).toBe(0);
  });
});

describe('photoOfTheDay', () => {
  it('picks the element at the day index', () => {
    const images = ['a', 'b', 'c'];
    const picked = photoOfTheDay(images, '2026-08-24');
    expect(images).toContain(picked);
    expect(picked).toBe(images[photoOfTheDayIndex(3, '2026-08-24')]);
  });

  it('returns undefined for an empty list', () => {
    expect(photoOfTheDay([], '2026-08-24')).toBeUndefined();
  });
});

/** UTC-based key, so the rotation test does not depend on the runner's zone. */
function localDateKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}
