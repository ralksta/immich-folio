/**
 * Admin API: browse and search Immich assets for the asset picker.
 * Supports pagination, favourites and a free-text search (#602).
 *
 * Read-only against Immich: every call is `POST /search/metadata`, a query
 * despite the verb.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { getConfig } from '@/lib/config';

interface ImmichSearchResult {
  assets: {
    items: Array<{
      id: string;
      type: string;
      originalFileName: string;
      thumbhash: string | null;
      fileCreatedAt: string;
      isFavorite: boolean;
    }>;
    nextPage: string | null;
  };
}

class ImmichStatusError extends Error {
  constructor(readonly status: number) {
    super(`Immich API returned ${status}`);
  }
}

const PAGE_SIZE = 50;
/** Far beyond any real scroll depth; keeps a crafted `page` away from Immich. */
const MAX_PAGE = 1000;
/** Longer than any filename or description fragment anybody types. */
const MAX_QUERY_LENGTH = 100;

/**
 * A query that is a date — `2024`, `2024-05` or `2024-05-17` — searches by the
 * year, month or day the photo was taken instead of by text. Null for anything
 * else, including impossible dates such as `2024-13` or `2024-02-31`.
 */
function dateRange(q: string): { takenAfter: string; takenBefore: string } | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(q);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : null;
  const day = m[3] ? Number(m[3]) : null;
  if (month !== null && (month < 1 || month > 12)) return null;
  const start = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  // Date.UTC rolls 2024-02-31 over into March; refuse rather than guess.
  if (day !== null && start.getUTCDate() !== day) return null;
  const end = new Date(start);
  if (day !== null) end.setUTCDate(end.getUTCDate() + 1);
  else if (month !== null) end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { takenAfter: start.toISOString(), takenBefore: end.toISOString() };
}

/** GET: browse (`?page=&favorites=`) or search (`&q=`) the library. */
export const GET = withAdmin(async (request: NextRequest) => {
  const config = getConfig();
  // Credentials, not `needsSetup`: this route is how the operator picks the
  // albums that gallery.yaml is built from, so refusing to run until that file
  // exists is a deadlock (#507).
  if (config.needsCredentials) {
    return NextResponse.json({ error: 'Immich not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get('page') ?? '1';
  const page = /^\d{1,4}$/.test(rawPage) ? Number(rawPage) : NaN;
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  }
  const favoritesOnly = searchParams.get('favorites') === 'true';
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: 'Search query too long' }, { status: 400 });
  }

  const base: Record<string, unknown> = {
    type: 'IMAGE',
    size: PAGE_SIZE,
    page,
    order: 'desc',
    isNotInAlbum: false,
  };
  if (favoritesOnly) base.isFavorite = true;

  // Immich's metadata search ANDs its fields, so "filename or description"
  // takes two searches whose pages are merged.
  const range = q ? dateRange(q) : null;
  const bodies: Record<string, unknown>[] = range
    ? [{ ...base, ...range }]
    : q
      ? [
          { ...base, originalFileName: q },
          { ...base, description: q },
        ]
      : [base];

  try {
    const results = await Promise.all(
      bodies.map(async (body) => {
        const res = await fetch(`${config.immich.apiUrl}/search/metadata`, {
          method: 'POST',
          headers: {
            'x-api-key': config.immich.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new ImmichStatusError(res.status);
        return (await res.json()) as ImmichSearchResult;
      }),
    );

    const seen = new Set<string>();
    const assets = results
      .flatMap((r) => r.assets.items)
      .filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      })
      .map((asset) => ({
        id: asset.id,
        originalFileName: asset.originalFileName,
        fileCreatedAt: asset.fileCreatedAt,
        isFavorite: asset.isFavorite,
      }));

    return NextResponse.json({
      assets,
      nextPage: results.some((r) => r.assets.nextPage) ? page + 1 : null,
    });
  } catch (err) {
    if (err instanceof ImmichStatusError) {
      return NextResponse.json({ error: `Immich API returned ${err.status}` }, { status: 502 });
    }
    console.error('[Admin] Failed to fetch assets from Immich:', err);
    return NextResponse.json({ error: 'Failed to connect to Immich' }, { status: 502 });
  }
});
