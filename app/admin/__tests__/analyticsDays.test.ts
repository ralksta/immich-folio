import { describe, it, expect } from 'vitest';
import { deviceSplitRatio, lastDays } from '../components/analyticsDays';

/**
 * "Last 14 Days" used to show the last 14 days that had any views, so quiet
 * days vanished and the chart could span a month (QA A-16).
 */
describe('lastDays', () => {
  const days = {
    '2026-08-28': { pageviews: 4 },
    '2026-09-20': { pageviews: 6 },
    '2026-09-29': { pageviews: 16 },
  };

  it('returns every calendar day up to today, with 0 for days without views', () => {
    const out = lastDays(days, 14, new Date('2026-09-29T12:00:00Z'));
    expect(out).toHaveLength(14);
    expect(out[0]).toEqual({ date: '2026-09-16', pageviews: 0 });
    expect(out[4]).toEqual({ date: '2026-09-20', pageviews: 6 });
    expect(out[13]).toEqual({ date: '2026-09-29', pageviews: 16 });
    // Older recorded days are outside the window, not pulled into it.
    expect(out.find((d) => d.date === '2026-08-28')).toBeUndefined();
  });

  it('counts days in UTC, the way the tracker keys them', () => {
    // 23:30 UTC on the 29th is already the 30th in Berlin.
    const out = lastDays(days, 2, new Date('2026-09-29T23:30:00Z'));
    expect(out.map((d) => d.date)).toEqual(['2026-09-28', '2026-09-29']);
  });

  it('crosses a month boundary without skipping or repeating a day', () => {
    const out = lastDays({}, 3, new Date('2026-10-01T00:00:00Z'));
    expect(out.map((d) => d.date)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });
});

describe('deviceSplitRatio (#907)', () => {
  it('returns null when no views have been recorded', () => {
    expect(deviceSplitRatio({ desktop: 0, mobile: 0 })).toBeNull();
    expect(deviceSplitRatio({})).toBeNull();
    expect(deviceSplitRatio(null)).toBeNull();
    expect(deviceSplitRatio(undefined)).toBeNull();
  });

  it('calculates the desktop percentage when views exist', () => {
    expect(deviceSplitRatio({ desktop: 1, mobile: 1 })).toBe(50);
    expect(deviceSplitRatio({ desktop: 3, mobile: 1 })).toBe(75);
    expect(deviceSplitRatio({ desktop: 1, mobile: 2 })).toBe(33);
    expect(deviceSplitRatio({ desktop: 10, mobile: 0 })).toBe(100);
    expect(deviceSplitRatio({ desktop: 0, mobile: 5 })).toBe(0);
  });
});
