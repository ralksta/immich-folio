/**
 * Admin API: Get assets of a specific album for the hero image picker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';

interface ImmichAlbumDetail {
  assets: Array<{
    id: string;
    type: string;
    originalFileName: string;
    thumbhash: string | null;
    fileCreatedAt: string;
    isFavorite: boolean;
  }>;
}

export async function GET(
  _request: NextRequest,
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

  try {
    const res = await fetch(`${config.immich.apiUrl}/albums/${albumId}`, {
      headers: {
        'x-api-key': config.immich.apiKey,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Immich API returned ${res.status}` }, { status: 502 });
    }

    const album = (await res.json()) as ImmichAlbumDetail;

    const assets = album.assets
      .filter((a) => a.type === 'IMAGE')
      .map((a) => ({
        id: a.id,
        originalFileName: a.originalFileName,
        fileCreatedAt: a.fileCreatedAt,
        isFavorite: a.isFavorite,
      }));

    return NextResponse.json({ assets, nextPage: null });
  } catch (err) {
    console.error('Failed to fetch album assets:', err);
    return NextResponse.json({ error: 'Failed to fetch album assets' }, { status: 500 });
  }
}
