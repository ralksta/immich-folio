/**
 * ZIP-of-originals streaming and the refusal page downloads answer with.
 *
 * Shared by the album archive route (/api/download/[album]/archive) and the
 * client proofing download (/api/proof/[token]/archive), which authorise
 * differently but must stream and refuse identically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { immich, type ImmichAsset } from '@/lib/immich';
import { contentDisposition, safeDownloadName } from '@/lib/downloadName';
import { getDictionary } from '@/lib/i18n';
import { getLocale, getServerDictionary } from '@/lib/i18n/server';

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
export function refusal(
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

export type RefusalReason = 'notAvailable' | 'rateLimited' | 'immichUnavailable' | 'limitReached';

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

/**
 * Stream `assets` as a ZIP of originals.
 *
 * archiver writes data descriptors, so entry sizes are never known up front and
 * memory stays flat no matter how large the album is. The loop pulls one
 * original at a time and stops as soon as the response is gone.
 */
export function streamArchive(albumName: string, assets: ImmichAsset[]): NextResponse {
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
