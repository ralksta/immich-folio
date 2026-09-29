import { describe, it, expect } from 'vitest';
import { lastDays } from '../components/analyticsDays';

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
