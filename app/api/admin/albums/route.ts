import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';

interface ImmichAlbumSummary {
  id: string;
  albumName: string;
  description: string;
  albumThumbnailAssetId: string | null;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

/** GET: List ALL shared Immich albums (not just allowlisted ones). */
export async function GET() {
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

  try {
    const res = await fetch(`${config.immich.apiUrl}/albums?shared=true`, {
      headers: {
        'x-api-key': config.immich.apiKey,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Immich API returned ${res.status}` }, { status: 502 });
    }

    const albums = (await res.json()) as ImmichAlbumSummary[];

    // Mark which albums are already configured
    const configuredIds = new Set(config.albums);
    const enriched = albums.map((album) => ({
      id: album.id,
      albumName: album.albumName,
      description: album.description || '',
      thumbnailAssetId: album.albumThumbnailAssetId,
      assetCount: album.assetCount,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
      isConfigured: configuredIds.has(album.id),
    }));

    // Sort: configured first, then by name
    enriched.sort((a, b) => {
      if (a.isConfigured !== b.isConfigured) return a.isConfigured ? -1 : 1;
      return a.albumName.localeCompare(b.albumName);
    });

    return NextResponse.json({ albums: enriched });
  } catch (err) {
    console.error('[Admin] Failed to fetch albums from Immich:', err);
    return NextResponse.json({ error: 'Failed to connect to Immich' }, { status: 502 });
  }
}
