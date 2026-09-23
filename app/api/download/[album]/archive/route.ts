/**
 * Archive download route — streams an album, or a selection of its assets, as
 * a ZIP of the originals.
 *
 * Sits beside the single-asset download and re-checks the exact same things:
 *
 *   - the album must be on the allowlist,
 *   - the album must have opted in with `download: true`,
 *   - every password gate on a route to it must be satisfied, and
 *   - every asset requested must actually belong to that album.
 *
 * A `GET` returns the whole album. A `POST` returns a selection, accepting
 * either `application/json` (`{ "assets": [<token>, …] }`) or the `assets=…`
 * form body the proofing modal posts — the form matters because the browser
 * then streams the response straight to disk instead of buffering the whole ZIP
 * in a blob.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { cookies } from 'next/headers';
import { immich, ImmichUnavailableError, type ImmichAsset } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { isAlbumReachable, siteLockResponse } from '@/lib/auth';
import { contentDisposition, safeDownloadName } from '@/lib/downloadName';
import { getDictionary } from '@/lib/i18n';
import { getLocale, getServerDictionary } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Far below even the single-asset limit: one request may pull down an entire
 * album of originals, so it must be a deliberate, rare action per visitor.
 */
const ARCHIVE_RPM = 5;

/**
 * Absolute ceiling on one selection, independent of album size. Together with
 * the token de-duplication in POST it bounds the upstream egress a single
 * request can ask for: without it, one 2 GB video's token repeated a thousand
 * times would stream 2 TB out of Immich.
 */
const MAX_SELECTION_ASSETS = 1000;

/**
 * Cap on the POST body, enforced while reading it rather than after. The token
 * list is the only payload a POST carries, so 256 KB comfortably fits the
 * ceiling above and a short body can never become a large parse.
 */
const MAX_BODY_BYTES = 256 * 1024;

/** Escape a value interpolated into the refusal page. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    char === '&'
      ? '&amp;'
      : char === '<'
        ? '&lt;'
        : char === '>'
          ? '&gt;'
          : char === '"'
            ? '&quot;'
            : '&#39;',
  );
}

/**
 * A refusal, rendered for whoever asked.
 *
 * A download begins as a navigation — the header link, or the proofing modal's
 * form POST — and only a success carries `Content-Disposition: attachment`. A
 * bare JSON body would therefore replace the gallery with
 * `{"error":"Too many requests"}` on a rate limit, which is the likely failure
 * (5 rpm, and the ZIP shows nothing until the first byte, so people click
 * again). Browsers get a page with a way back; callers asking for JSON keep it.
 *
 * The page speaks the site's language; the JSON stays English, like every other
 * API error.
 */
function refusal(
  request: NextRequest,
  status: number,
  reason: RefusalReason,
  retryAfter?: number,
): NextResponse {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (retryAfter) headers['Retry-After'] = String(retryAfter);

  if (!(request.headers.get('accept') ?? '').includes('text/html')) {
    return NextResponse.json({ error: getDictionary('en').download[reason] }, { status, headers });
  }

  const t = getServerDictionary().download;
  headers['Content-Type'] = 'text/html; charset=utf-8';
  return new NextResponse(
    `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8">` +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      `<title>${escapeHtml(t.unavailableTitle)}</title></head>` +
      '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;line-height:1.6">' +
      `<h1 style="font-size:1.25rem">${escapeHtml(t.unavailableTitle)}</h1>` +
      `<p>${escapeHtml(t[reason])}</p>` +
      `<p><a href="${escapeHtml(backHref(request))}">${escapeHtml(t.back)}</a></p>` +
      '</body></html>',
    { status, headers },
  );
}

type RefusalReason = 'notAvailable' | 'rateLimited' | 'immichUnavailable';

/**
 * Where the refusal page's link leads: the page the download was started from,
 * so a visitor lands back on the album rather than the home page. Only a
 * same-origin `Referer` is followed — anything else would turn this page into an
 * open redirect with our name on it.
 */
function backHref(request: NextRequest): string {
  const referer = request.headers.get('referer');
  if (!referer) return '/';
  try {
    const url = new URL(referer);
    if (url.origin !== request.nextUrl.origin) return '/';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
}

/**
 * A unique, ZIP-safe entry name. Originals can collide ("IMG_0001.jpg" from two
 * cards), and a ZIP with duplicate entry names is ambiguous to unzip.
 */
function uniqueEntryName(raw: string | undefined, used: Set<string>): string {
  const base = safeDownloadName(raw);
  let name = base;
  let n = 2;
  while (used.has(name)) {
    const dot = base.lastIndexOf('.');
    name = dot > 0 ? `${base.slice(0, dot)}-${n}${base.slice(dot)}` : `${base}-${n}`;
    n++;
  }
  used.add(name);
  return name;
}

/**
 * Append one entry, resolving once it has been written (or the archive has been
 * torn down because the visitor left).
 *
 * archiver processes entries strictly one at a time — that is what keeps memory
 * flat — but `append()` only *queues* them. Firing every `append` up front (and
 * so opening every upstream request at once) is what made a large album's later
 * originals sit long enough to time out and truncate the ZIP. Awaiting the
 * `entry` event holds the loop until the previous file has finished, so only
 * one original is ever in flight. `close` resolves too, so an aborted download
 * stops the loop rather than hanging on a file nothing will read.
 *
 * On `close` and `error` the source is destroyed as well. archiver does not do
 * that for a queued or half-read entry, and the upstream body would otherwise
 * hold its socket out of undici's pool until GC finalises it (#635).
 */
function appendEntry(archive: archiver.Archiver, source: Readable, name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      archive.off('entry', onEntry);
      archive.off('error', onError);
      archive.off('close', onClose);
    };
    const onEntry = () => {
      cleanup();
      resolve();
    };
    // `close` fires when the response is consumed or aborted. Resolving on it
    // lets the loop see `archive.destroyed` and stop, rather than hanging on a
    // file nothing will read.
    const onClose = () => {
      cleanup();
      source.destroy();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      source.destroy();
      reject(error);
    };
    archive.once('entry', onEntry);
    archive.once('error', onError);
    archive.once('close', onClose);
    archive.append(source, { name });
  });
}

/** A refusal to short-circuit with, or a decoded album ready to stream. */
type ResolvedAlbum = { error: Response } | { albumName: string; assets: ImmichAsset[] };

/**
 * The shared authorisation preamble for both verbs: rate limit, site lock, and
 * every check the single-asset download performs before streaming a byte.
 */
async function resolveAlbum(
  request: NextRequest,
  params: { album: string },
): Promise<ResolvedAlbum> {
  const ip = getClientIp(request);
  // Its own bucket, not the single-asset `download:` one: the two share a
  // client but enforce different limits (5 vs 30 rpm), and letting a handful of
  // single-file downloads spend the whole-album budget would be wrong.
  const rl = checkRateLimit(`archive:${ip}`, ARCHIVE_RPM);
  if (!rl.success) {
    return {
      error: refusal(request, 429, 'rateLimited', retryAfterSeconds(rl.resetAt)),
    };
  }

  const locked = siteLockResponse(request);
  if (locked) return { error: locked };

  const albumId = decodeAssetId(params.album);
  if (!albumId) return { error: refusal(request, 404, 'notAvailable') };

  const config = getConfig();
  if (!config.albums.includes(albumId)) return { error: refusal(request, 404, 'notAvailable') };
  if (!config.albumDownloads[albumId]) return { error: refusal(request, 404, 'notAvailable') };

  // Every gate on every route to the album — see the single-asset route.
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  if (!isAlbumReachable(albumId, getCookie)) {
    return { error: refusal(request, 404, 'notAvailable') };
  }

  let album;
  try {
    album = await immich.getAlbum(albumId);
  } catch (error) {
    if (error instanceof ImmichUnavailableError) {
      return {
        error: refusal(request, 503, 'immichUnavailable', 30),
      };
    }
    throw error;
  }
  if (!album) return { error: refusal(request, 404, 'notAvailable') };

  const assets = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO');
  return { albumName: album.albumName, assets };
}

/**
 * Stream `assets` as a ZIP of originals.
 *
 * archiver writes data descriptors, so entry sizes are never known up front and
 * memory stays flat no matter how large the album is. The loop pulls one
 * original at a time and stops as soon as the response is gone.
 */
function streamArchive(albumName: string, assets: ImmichAsset[]): NextResponse {
  const archive = archiver('zip', { store: true });
  archive.on('error', (err) => {
    // A visitor cancelling the download is not a failure worth a log line.
    if (err.name === 'AbortError') return;
    console.error(`[Download] Archive stream failed:`, err);
  });

  const body = Readable.toWeb(archive) as unknown as ReadableStream;

  // Fill the archive in the background: the response has to go out first so the
  // browser starts reading, and each originals fetch is awaited in turn.
  void (async () => {
    try {
      const used = new Set<string>();
      for (const asset of assets) {
        // The visitor left (or the archive failed): stop pulling originals.
        if (archive.destroyed) break;
        const result = await immich.streamAsset(asset.id, 'original');
        if (!result) continue;
        if (archive.destroyed) {
          // Left while the headers were on their way: release the body unread.
          await result.stream.cancel();
          break;
        }
        const nodeStream = Readable.fromWeb(
          result.stream as unknown as import('node:stream/web').ReadableStream,
        );
        await appendEntry(archive, nodeStream, uniqueEntryName(asset.originalFileName, used));
      }
      if (!archive.destroyed) await archive.finalize();
    } catch (err) {
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  const zipName = `${safeDownloadName(albumName, 'album')}.zip`;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(zipName),
      // Private: authorised per visitor, so a shared cache must not hand the
      // archive to the next one.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Read the POST body with a hard cap, then pull the token list out of it.
 *
 * Read by hand rather than through `request.json()`: that helper parses the
 * whole body before anything can object, which is the one place an unbounded
 * payload could land. `Content-Length` is checked first (cheap), and the read
 * itself stops the moment the cap is passed (so a chunked body is capped too).
 */
async function readSelectedTokens(request: NextRequest): Promise<string[] | null> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;

  let text: string;
  try {
    const raw = await readBodyCapped(request, MAX_BODY_BYTES);
    if (raw === null) return null;
    text = raw;
  } catch {
    return null;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(text) as { assets?: unknown };
      if (!Array.isArray(parsed?.assets)) return null;
      return parsed.assets.filter((token): token is string => typeof token === 'string');
    } catch {
      return null;
    }
  }

  // The proofing modal's form POST: one `assets` field per token.
  const form = new URLSearchParams(text);
  const tokens = form.getAll('assets').filter((token) => token.length > 0);
  return tokens.length > 0 ? tokens : null;
}

/** Read a request body as text, aborting once it exceeds `limit` bytes. */
async function readBodyCapped(request: NextRequest, limit: number): Promise<string | null> {
  const stream = request.body;
  if (!stream) return '';

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ album: string }> },
) {
  const { album } = await params;
  const resolved = await resolveAlbum(request, { album });
  if ('error' in resolved) return resolved.error;
  return streamArchive(resolved.albumName, resolved.assets);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ album: string }> },
) {
  const { album } = await params;
  const resolved = await resolveAlbum(request, { album });
  if ('error' in resolved) return resolved.error;

  const tokens = await readSelectedTokens(request);
  if (!tokens || tokens.length === 0) {
    return refusal(request, 404, 'notAvailable');
  }

  // Every token must decode to an asset that really belongs to the album; a
  // token is unforgeable (AES-GCM), but membership is the check that keeps one
  // album's archive from naming another album's assets.
  //
  // The `seen` set matters as much as the membership check: a token is only a
  // lookup, not a consume, so the same asset could otherwise be appended once
  // per occurrence. With the absolute ceiling that bounds the whole request.
  const byId = new Map(resolved.assets.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const selected: ImmichAsset[] = [];
  for (const token of tokens) {
    if (selected.length >= MAX_SELECTION_ASSETS) {
      return refusal(request, 404, 'notAvailable');
    }
    const assetId = decodeAssetId(token);
    if (!assetId) return refusal(request, 404, 'notAvailable');
    if (seen.has(assetId)) continue;
    const asset = byId.get(assetId);
    if (!asset) return refusal(request, 404, 'notAvailable');
    seen.add(assetId);
    selected.push(asset);
  }
  if (selected.length === 0) {
    return refusal(request, 404, 'notAvailable');
  }

  return streamArchive(resolved.albumName, selected);
}
