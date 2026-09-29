/**
 * Display form of a journal entry's `date:` frontmatter. Client-safe (no `fs`),
 * shared by the /journal index and the entry header so both show the same thing.
 *
 * The value is typed by hand, so it is read as a calendar date, not an instant:
 *
 * - `2026-03-15` (optionally followed by a time) is formatted in UTC. `new Date()`
 *   reads a date-only ISO string as UTC midnight, and formatting that in the
 *   server's or browser's timezone showed Mar 14 west of Greenwich.
 * - `2026-03` shows month and year — `new Date('2026-03')` invented the 1st.
 * - Anything else (`15.03.2026`, `March 2026`, `Spring 2026`, an impossible
 *   `2026-02-30`) is shown as written instead of "Invalid Date" or a guessed day.
 */
const DAY = /^(\d{4})-(\d{2})-(\d{2})(?=$|[T\s])/;
const MONTH = /^(\d{4})-(\d{2})$/;

export function formatJournalDate(raw: string | undefined, locale: string): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const day = DAY.exec(value);
  if (day) {
    const [y, m, d] = [Number(day[1]), Number(day[2]), Number(day[3])];
    const date = new Date(Date.UTC(y, m - 1, d));
    // Date.UTC rolls 2026-02-30 over into March; refuse instead of moving it.
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
      return value;
    }
    return date.toLocaleDateString(locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  const month = MONTH.exec(value);
  if (month) {
    const [y, m] = [Number(month[1]), Number(month[2])];
    if (m < 1 || m > 12) return value;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
    });
  }

  return value;
}

/**
 * The `datetime` attribute for a `<time>` around that display form: the
 * calendar date (`2026-03-15`) or month (`2026-03`) it names, or null when
 * the value is free text — `Spring 2026` has no machine-readable form, and a
 * `<time>` carrying one would claim its text is a valid date string.
 */
export function journalDateTime(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const day = DAY.exec(value);
  if (day) {
    // An impossible date (2026-02-30) is displayed as typed; the attribute
    // must not claim it either.
    return formatJournalDate(value, 'en') === value ? null : `${day[1]}-${day[2]}-${day[3]}`;
  }
  const month = MONTH.exec(value);
  if (month) {
    const m = Number(month[2]);
    return m >= 1 && m <= 12 ? `${month[1]}-${month[2]}` : null;
  }
  return null;
}
