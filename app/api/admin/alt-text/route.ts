import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';
import {
  albumPaths,
  buildAltTextReport,
  pickImmichWebUrl,
  type AltTextAlbumInput,
} from '@/lib/admin/alt-text';

/**
 * Immich's *External domain* setting, or null when unset or unreadable. A
 * failure here must not cost the report — the links just fall back.
 */
async function immichExternalDomain(apiUrl: string, apiKey: string, timeoutMs: number) {
  try {
    const res = await fetch(`${apiUrl}/server/config`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { externalDomain?: string };
    return body.externalDomain ?? null;
  } catch {
    return null;
  }
}

/**
 * Alt-text coverage of every published album, for the diagnostics page.
 *
 * Goes through `immich.getAlbum()`, so it shares the album cache with the
 * public site: a check right after browsing the gallery costs no Immich calls.
 * An album that fails to load is counted, not fatal — the rest still report.
 */
export const GET = withAdmin(async () => {
  const config = getConfig();
  if (config.needsCredentials) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const paths = albumPaths(config.subpages);
  const inputs: AltTextAlbumInput[] = [];
  let unreadable = 0;

  const [albums, externalDomain] = await Promise.all([
    Promise.all(config.albums.map((id) => immich.getAlbum(id).catch(() => undefined))),
    immichExternalDomain(config.immich.apiUrl, config.immich.apiKey, config.immichTimeoutMs),
  ]);
  const immichLink = pickImmichWebUrl(externalDomain, config.immich.apiUrl);
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
      immichUrl: immichLink.url,
      immichUrlSource: immichLink.source,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
