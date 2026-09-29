/**
 * The days the analytics chart shows: the last `count` calendar days up to
 * `today`, each one present, with 0 for a day nobody visited.
 *
 * The chart used to take the last 14 *recorded* days, so a quiet week simply
 * vanished and "Last 14 Days" could span a month (QA A-16).
 *
 * Keys are UTC dates (`YYYY-MM-DD`), the way /api/analytics/track writes them,
 * so `today` is read in UTC too — a local date would be a day off either side
 * of midnight.
 */
export function lastDays(
  days: Record<string, { pageviews?: number } | undefined>,
  count: number,
  today: Date,
): Array<{ date: string; pageviews: number }> {
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const out: Array<{ date: string; pageviews: number }> = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date, pageviews: days[date]?.pageviews ?? 0 });
  }
  return out;
}
