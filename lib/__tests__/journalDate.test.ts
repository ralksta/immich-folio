import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatJournalDate, journalDateTime } from '../journalDate';

/**
 * The /journal index formatted `new Date(frontmatter.date)` in the server's
 * timezone: `2026-03-15` is UTC midnight, so every server west of Greenwich
 * printed Mar 14. Hand-typed dates became "Invalid Date", and the entry page
 * printed the raw string next to the index's localized one.
 *
 * Run under a negative UTC offset so a regression to local-time formatting
 * shows up on any machine.
 */
let savedTz: string | undefined;
beforeAll(() => {
  savedTz = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
});
afterAll(() => {
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
});

describe('formatJournalDate', () => {
  it('keeps the calendar day of a date-only value west of UTC', () => {
    // Sanity check that the offset is in effect: this is the old code path.
    expect(new Date('2026-03-15').getDate()).toBe(14);
    expect(formatJournalDate('2026-03-15', 'en-US')).toBe('Mar 15, 2026');
    expect(formatJournalDate('2026-01-01', 'de-DE')).toBe('1. Jan. 2026');
  });

  it('takes the written day of a value with a time', () => {
    expect(formatJournalDate('2026-03-15T23:30:00+01:00', 'en-US')).toBe('Mar 15, 2026');
    expect(formatJournalDate('2026-03-15 08:00', 'en-US')).toBe('Mar 15, 2026');
  });

  it('shows a year-month value without inventing a day', () => {
    expect(formatJournalDate('2026-03', 'en-US')).toBe('March 2026');
  });

  it.each(['15.03.2026', 'March 2026', 'Spring 2026', '2026-02-30', '2026-13', '2026-03-150'])(
    'shows %s as written instead of Invalid Date or a guessed day',
    (raw) => {
      expect(formatJournalDate(raw, 'en-US')).toBe(raw);
    },
  );

  it('returns null for a missing or blank date', () => {
    expect(formatJournalDate(undefined, 'en-US')).toBeNull();
    expect(formatJournalDate('   ', 'en-US')).toBeNull();
  });
});

/** The `datetime` of the `<time>` the index and the entry header render (P-21). */
describe('journalDateTime', () => {
  it('gives the calendar day, without the time a value may carry', () => {
    expect(journalDateTime('2026-03-15')).toBe('2026-03-15');
    expect(journalDateTime(' 2026-03-15T23:30:00+01:00 ')).toBe('2026-03-15');
  });

  it('gives a year-month value as a month', () => {
    expect(journalDateTime('2026-03')).toBe('2026-03');
  });

  it.each(['15.03.2026', 'Spring 2026', '2026-02-30', '2026-13', '', undefined])(
    'has no machine-readable form for %s',
    (raw) => {
      expect(journalDateTime(raw)).toBeNull();
    },
  );
});
