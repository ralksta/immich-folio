/**
 * Admin API: assets of a specific album, for the hero image picker and the
 * manual sort editor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';
import { isUuid } from '@/lib/uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getConfig();
  if (config.needsSetup) {
    return NextResponse.json({ error: 'Immich not configured' }, { status: 503 });
  }

  const { albumId } = await params;

  // Without this, `..%2f..%2fusers` resolves inside fetch() to an arbitrary
  // Immich endpoint, called with the server's API key.
  if (!isUuid(albumId)) {
    return NextResponse.json({ error: 'Invalid album ID' }, { status: 400 });
  }

  // Videos are opt-in. The hero picker feeds imageUrl()/assetPlaceholder and
  // wants images only; the sort editor must show everything the public grid
  // renders, or a video could never be pinned and would always fall to the tail.
  const includeVideos = request.nextUrl.searchParams.get('types') === 'all';

  try {
    // Via the client, not a bare fetch of `GET /albums/:id`: Immich 3.x no
    // longer embeds assets in that response, so reading `album.assets` returned
    // nothing (and threw outright when the key was absent). getAlbumAssetsRaw()
    // pages through the metadata search and applies the album's own order, so
    // this list matches what the site renders under `sort: immich`.
    const all = await immich.getAlbumAssetsRaw(albumId);

    const assets = all
      .filter((a) => a.type === 'IMAGE' || (includeVideos && a.type === 'VIDEO'))
      .map((a) => ({
        id: a.id,
        type: a.type,
        originalFileName: a.originalFileName,
        fileCreatedAt: a.fileCreatedAt,
        isFavorite: a.isFavorite ?? false,
      }));

    return NextResponse.json({ assets, nextPage: null });
  } catch (err) {
    console.error('Failed to fetch album assets:', err);
    return NextResponse.json({ error: 'Failed to fetch album assets' }, { status: 500 });
  }
}
