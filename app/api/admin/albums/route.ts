import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';

interface ImmichAlbumSummary {
  id: string;
  albumName: string;
  /** Immich's own flag. Absent on older versions, which is not the same as false. */
  shared?: boolean;
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
  // Credentials, not `needsSetup`: this route is how the operator picks the
  // albums that gallery.yaml is built from, so refusing to run until that file
  // exists is a deadlock (#507).
  if (config.needsCredentials) {
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
      // Immich ignores ?shared=true and returns everything, so this list is the
      // whole library rather than the shared part of it (#515). Passing the flag
      // through lets the picker say which albums Immich still considers private
      // — the accident-prevention the filter was supposed to give, without
      // taking away the ability to publish them.
      shared: album.shared,
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
