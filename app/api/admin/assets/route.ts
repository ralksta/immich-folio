/**
 * Admin API: Browse Immich assets for the hero picker.
 * Supports pagination and fetching favorites first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
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

/** GET: Search/browse assets from Immich for hero image selection. */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const favoritesOnly = searchParams.get('favorites') === 'true';
  const pageSize = 50;

  try {
    // Use Immich search/metadata endpoint to query assets
    const body: Record<string, unknown> = {
      type: 'IMAGE',
      size: pageSize,
      page,
      order: 'desc',
      isNotInAlbum: false,
    };

    if (favoritesOnly) {
      body.isFavorite = true;
    }

    const res = await fetch(`${config.immich.apiUrl}/search/metadata`, {
      method: 'POST',
      headers: {
        'x-api-key': config.immich.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Immich API returned ${res.status}` }, { status: 502 });
    }

    const data = (await res.json()) as ImmichSearchResult;
    const assets = data.assets.items.map((asset) => ({
      id: asset.id,
      originalFileName: asset.originalFileName,
      fileCreatedAt: asset.fileCreatedAt,
      isFavorite: asset.isFavorite,
    }));

    return NextResponse.json({
      assets,
      nextPage: data.assets.nextPage ? page + 1 : null,
    });
  } catch (err) {
    console.error('[Admin] Failed to fetch assets from Immich:', err);
    return NextResponse.json({ error: 'Failed to connect to Immich' }, { status: 502 });
  }
}
