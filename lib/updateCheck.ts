/**
 * Update notice for the admin dashboard (#496).
 *
 * Self-hosted software that never mentions a new release gets run for months
 * on an old version, which matters here because there have already been
 * security releases.
 *
 * The check is a single call to the GitHub releases API, answered from a
 * day-long cache, and switchable off with `UPDATE_CHECK=false`. It fails
 * quietly in every direction: no network, a rate limit, a malformed answer or
 * an offline instance must never cost the dashboard its other information.
 */

import { env } from './env';
import pkg from '../package.json';

/** The version this instance is running. */
export const CURRENT_VERSION: string = pkg.version;

const RELEASES_URL = 'https://api.github.com/repos/ralksta/immich-folio/releases/latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

export interface UpdateStatus {
  current: string;
  latest: string | null;
  /** Null when the check is off, or nothing is known yet. */
  updateAvailable: boolean | null;
}

/**
 * Compare two dot-separated versions numerically.
 *
 * Returns a negative number when `a` is older, positive when newer, 0 when
 * equal. A leading `v` is tolerated because that is how the releases API spells
 * a tag. Anything after a `-` is dropped: a pre-release is compared on its
 * numbers alone, which is enough to decide whether to mention it.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (version: string) =>
    version
      .trim()
      .replace(/^v/i, '')
      .split('+')[0]
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);

  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Whether `latest` is worth telling the operator about. */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

/**
 * Pull the tag out of a releases API payload.
 *
 * Written against `unknown` because this is a third-party response: a shape
 * that changed, or an error object served with a 200, must yield null rather
 * than throw inside the dashboard.
 */
export function parseLatestTag(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const tag = (payload as { tag_name?: unknown }).tag_name;
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim();
  // A tag that is not a version cannot be compared, and guessing would be
  // worse than saying nothing. Anchored at both ends: guarding only the start
  // let anything beginning with a digit through, and a date-style tag then
  // read as version 2024 and left every instance showing an update that does
  // not exist. A pre-release suffix is allowed but may not itself contain a
  // '-', which is what keeps "2024-01-05" out; build metadata is allowed and
  // ignored when ordering, as semver says.
  return /^v?\d+(\.\d+)*(-[0-9A-Za-z.]+)?(\+[0-9A-Za-z.]+)?$/.test(trimmed) ? trimmed : null;
}

let cached: { latest: string | null; at: number } | null = null;

/** Drop the memoised answer. Exposed for tests. */
export function resetUpdateCache(): void {
  cached = null;
}

/**
 * The latest published version, or null if it is not known.
 *
 * Cached for a day whether the answer was a version or a failure, so a
 * dashboard left open does not hammer the API and an outage is not retried on
 * every page load.
 */
async function fetchLatestVersion(): Promise<string | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.latest;

  let latest: string | null = null;
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (response.ok) latest = parseLatestTag(await response.json());
  } catch {
    // Offline, blocked, rate-limited or timed out. The dashboard simply does
    // not mention updates this time.
    latest = null;
  }

  cached = { latest, at: Date.now() };
  return latest;
}

/** The update status for the admin dashboard. Never throws. */
export async function getUpdateStatus(): Promise<UpdateStatus> {
  if (!env.UPDATE_CHECK) {
    return { current: CURRENT_VERSION, latest: null, updateAvailable: null };
  }

  const latest = await fetchLatestVersion();
  return {
    current: CURRENT_VERSION,
    latest,
    updateAvailable: latest === null ? null : isNewerVersion(latest, CURRENT_VERSION),
  };
}
