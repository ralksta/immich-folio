import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';
import {
  albumPaths,
  buildAltTextReport,
  immichWebUrl,
  type AltTextAlbumInput,
} from '@/lib/admin/alt-text';

/**
 * Alt-text coverage of every published album, for the diagnostics page.
 *
 * Goes through `immich.getAlbum()`, so it shares the album cache with the
 * public site: a check right after browsing the gallery costs no Immich calls.
 * An album that fails to load is counted, not fatal — the rest still report.
 */
export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getConfig();
  if (config.needsCredentials) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const paths = albumPaths(config.subpages);
  const inputs: AltTextAlbumInput[] = [];
  let unreadable = 0;

  const albums = await Promise.all(
    config.albums.map((id) => immich.getAlbum(id).catch(() => undefined)),
  );
  albums.forEach((album, i) => {
    if (!album) {
      // null is "Immich says it does not exist" — the doctor's album-ids check
      // already reports that. undefined is a failed request.
      if (album === undefined) unreadable++;
      return;
    }
    inputs.push({
      id: album.id,
      name: album.albumName,
      path: paths.get(config.albums[i]) ?? '/',
      assets: album.assets,
    });
  });

  return NextResponse.json(
    {
      ...buildAltTextReport(inputs, config.exif.caption),
      unreadable,
      immichUrl: immichWebUrl(config.immich.apiUrl),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
