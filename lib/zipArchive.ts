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
import { contentDisposition, editedDownloadName, safeDownloadName } from '@/lib/downloadName';
import { getClientIp } from '@/lib/rate-limit';
import { getDictionary } from '@/lib/i18n';
import { getLocale, getServerDictionary } from '@/lib/i18n/server';
import { getConfigOrNull } from '@/lib/config';
import { accentForMode, resolveTheme } from '@/lib/config/theme';
import { env } from '@/lib/env';
import { scrubLocationStream } from '@/lib/locationScrub';

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
  // Route handlers are outside proxy.ts, so this page gets no site policy. It
  // needs nothing but its own inline <style>: no script, no image, no form.
  headers['Content-Security-Policy'] =
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
  return new NextResponse(
    `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8">` +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      `<title>${escapeHtml(t.unavailableTitle)}</title><style>${refusalCss()}</style></head>` +
      `<body><main><h1>${escapeHtml(t.unavailableTitle)}</h1>` +
      `<p>${escapeHtml(t[reason])}</p>` +
      `<p><a href="${escapeHtml(backHref(request))}">${escapeHtml(t.back)}</a></p>` +
      '</main></body></html>',
    { status, headers },
  );
}

type Palette = { bg: string; text: string; muted: string };

/**
 * Each preset's `--bg-primary`, `--text-primary` and `--text-secondary` per
 * colour mode, as app/tokens.css defines them (`default` is its `:root` and
 * `[data-theme='light']`, which `studio` uses unchanged). The stylesheets are
 * bundled into hashed chunks a route handler cannot name, so the values are
 * repeated here; lib/__tests__/refusal-palette.test.ts fails when they drift.
 * The accent comes from the configured theme.
 */
export const REFUSAL_PALETTES: Record<string, { dark: Palette; light: Palette }> = {
  default: {
    dark: { bg: '#1a1a1a', text: '#f5f5f0', muted: '#a0a09a' },
    light: { bg: '#f5f5f0', text: '#1a1a18', muted: '#4a4a45' },
  },
  'studio-modern': {
    dark: { bg: '#121212', text: '#f4f4f2', muted: '#9c9c96' },
    light: { bg: '#fafaf8', text: '#161614', muted: '#5a5a55' },
  },
  minimal: {
    dark: { bg: '#000000', text: '#ffffff', muted: '#9e9e9e' },
    light: { bg: '#ffffff', text: '#000000', muted: '#475569' },
  },
  editorial: {
    dark: { bg: '#1a1714', text: '#ede8e0', muted: '#9a9086' },
    light: { bg: '#faf8f4', text: '#1a1714', muted: '#4a4540' },
  },
  classic: {
    dark: { bg: '#121210', text: '#f0ece4', muted: '#a09888' },
    light: { bg: '#fdfbf5', text: '#1a1810', muted: '#4a4535' },
  },
  noir: {
    dark: { bg: '#111014', text: '#f0ebe0', muted: '#998f80' },
    light: { bg: '#faf5ef', text: '#1a1610', muted: '#4a4538' },
  },
  monograph: {
    dark: { bg: '#151515', text: '#e8e8e8', muted: '#a5a5a5' },
    light: { bg: '#fafafa', text: '#111111', muted: '#475569' },
  },
  kunsthalle: {
    dark: { bg: '#2b2b29', text: '#f0efeb', muted: '#c6c4bd' },
    light: { bg: '#dddcd8', text: '#1b1b19', muted: '#3f3e3a' },
  },
  ma: {
    dark: { bg: '#1a1917', text: '#ece7dd', muted: '#b5ad9f' },
    light: { bg: '#f0ede6', text: '#1f1d1a', muted: '#4d4943' },
  },
  cyanotype: {
    dark: { bg: '#0e1621', text: '#e3eaf0', muted: '#a8b7c6' },
    light: { bg: '#eef2f4', text: '#10243a', muted: '#34495f' },
  },
  salon: {
    dark: { bg: '#1c1315', text: '#f3eae7', muted: '#c5b1ad' },
    light: { bg: '#f5efec', text: '#271618', muted: '#573f42' },
  },
  birch: {
    dark: { bg: '#121613', text: '#e9eee9', muted: '#aab5ac' },
    light: { bg: '#f3f5f1', text: '#19201b', muted: '#434e46' },
  },
};

const HEX_COLOUR = /^#[0-9a-f]{3,8}$/i;

/**
 * The refusal page's stylesheet, in the site's colour mode and accent, so a
 * visitor bounced from a dark gallery does not land on a white system page.
 * `auto` follows the visitor's OS, as the site does before its script runs.
 */
function refusalCss(): string {
  const config = getConfigOrNull();
  const theme = config?.theme ?? resolveTheme();
  const mode = config?.colorMode ?? 'dark';
  const palette = REFUSAL_PALETTES[theme.preset] ?? REFUSAL_PALETTES.default;
  const vars = (m: 'dark' | 'light') => {
    const c = palette[m];
    const accent = accentForMode(theme, m);
    return (
      `color-scheme:${m};--bg:${c.bg};--text:${c.text};--muted:${c.muted};` +
      `--accent:${HEX_COLOUR.test(accent) ? accent : c.text}`
    );
  };
  const base =
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'padding:0 1.5rem;box-sizing:border-box;background:var(--bg);color:var(--text);' +
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6}' +
    'main{max-width:32rem}h1{font-size:1.25rem;font-weight:500;margin:0 0 .75rem}' +
    'p{margin:0 0 1rem;color:var(--muted)}' +
    'a{color:var(--text);text-decoration-color:var(--accent);' +
    'text-decoration-thickness:2px;text-underline-offset:.25em}';
  const root =
    mode === 'auto'
      ? `:root{${vars('dark')}}@media (prefers-color-scheme: light){:root{${vars('light')}}}`
      : `:root{${vars(mode)}}`;
  return root + base;
}

export type RefusalReason = 'notAvailable' | 'rateLimited' | 'immichUnavailable' | 'limitReached';

/**
 * Where the refusal page's link leads: the page the download was started from,
 * so a visitor lands back on the album rather than the home page. Only a
 * same-origin `Referer` is followed, and only its path — anything else would
 * turn this page into an open redirect with our name on it.
 *
 * "Same origin" is judged by the host the visitor addressed. It used to be
 * `request.nextUrl.origin`, which Next rebuilds from its own bind address —
 * `localhost` behind `-H 127.0.0.1` or a reverse proxy — so no real Referer
 * ever matched and the link always led home.
 */
function backHref(request: NextRequest): string {
  const referer = request.headers.get('referer');
  if (!referer) return '/';
  try {
    const url = new URL(referer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '/';
    if (!requestHosts(request).has(url.host.toLowerCase())) return '/';
    // `//evil.example/x` is a path to URL, but a host to the browser.
    if (url.pathname.startsWith('//')) return '/';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
}

/**
 * The hosts this request may have been addressed to: the `Host` header and,
 * only with `TRUSTED_PROXY_HOPS` set (the same trust lib/rate-limit.ts needs),
 * the proxy's `X-Forwarded-Host`. A forged header can at most make a Referer
 * match; the link that results is still a path on this site.
 */
function requestHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>([request.nextUrl.host.toLowerCase()]);
  const host = request.headers.get('host');
  if (host) hosts.add(host.trim().toLowerCase());
  if (env.TRUSTED_PROXY_HOPS > 0) {
    for (const h of (request.headers.get('x-forwarded-host') ?? '').split(',')) {
      if (h.trim()) hosts.add(h.trim().toLowerCase());
    }
  }
  return hosts;
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
 * The timestamp an entry carries: when the photo was taken, not when the ZIP
 * was built. Without it every file unpacked with the download time, so a
 * folder sorted by date lost the album's order.
 *
 * A ZIP stores a wall-clock time with no zone, and archiver writes the UTC
 * fields of the Date it is given. Immich's `localDateTime` is exactly that
 * shape — the capture time in the photographer's zone, written as if it were
 * UTC — so it lands in the archive as the time on the camera, whatever zone
 * the server runs in. `dateTimeOriginal` and `fileCreatedAt` are real instants
 * and only the fallbacks. All three come with the album response: no extra
 * Immich request. Undefined leaves archiver's default (now).
 */
export function entryDate(asset: ImmichAsset): Date | undefined {
  for (const raw of [asset.localDateTime, asset.exifInfo?.dateTimeOriginal, asset.fileCreatedAt]) {
    if (!raw) continue;
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
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
function appendEntry(
  archive: archiver.Archiver,
  source: Readable,
  name: string,
  date?: Date,
): Promise<void> {
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
    archive.append(source, date ? { name, date } : { name });
  });
}

/**
 * Archives one client may have open at the same time, the album archive and
 * the proofing archive counted together.
 *
 * The 5-per-minute rate limit bounds how often an archive starts, not how long
 * it lives. Each open archive holds an Immich socket and a few MB of buffers
 * for as long as the client keeps its connection, so a client that reads
 * slowly could otherwise stack them up minute after minute. Two leaves room
 * for the proofing modal's selection and album ZIPs side by side.
 */
export const MAX_CONCURRENT_ARCHIVES = 2;

/** `Retry-After` for a refusal at the concurrency cap. */
const ARCHIVE_SLOT_RETRY_AFTER = 30;

/**
 * How long an archive waits for the client to take the next bytes before it
 * is torn down, upstream Immich stream included.
 *
 * Counted from the last pull, and only while data is waiting for the client: a
 * slow download that keeps reading never trips it, and neither does a slow
 * Immich (the pull is then still pending, and the upstream request has its own
 * timeouts). It is needed because backpressure pauses undici's body timeout,
 * so a client that stopped reading kept the archive and its Immich socket for
 * as long as it held the TCP connection open.
 */
export const ARCHIVE_STALL_TIMEOUT_MS = 60_000;

/** Open archives per client IP. An entry is removed when it drops to 0. */
const inFlight = new Map<string, number>();

/**
 * Take one of the client's archive slots. Returns the release function (safe
 * to call more than once), or `null` when the client is at the cap.
 */
function acquireArchiveSlot(ip: string): (() => void) | null {
  const current = inFlight.get(ip) ?? 0;
  if (current >= MAX_CONCURRENT_ARCHIVES) return null;
  inFlight.set(ip, current + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (inFlight.get(ip) ?? 1) - 1;
    if (remaining > 0) inFlight.set(ip, remaining);
    else inFlight.delete(ip);
  };
}

/** Test seam: archives currently holding a slot for `ip`. */
export function __archivesInFlight(ip: string): number {
  return inFlight.get(ip) ?? 0;
}

export type ArchiveStreamer = (albumName: string, assets: ImmichAsset[]) => Response;

/**
 * Run an archive route's handler inside one of the client's archive slots.
 *
 * The slot is taken before the handler runs, so before any Immich request, and
 * a client that already has `MAX_CONCURRENT_ARCHIVES` open gets a 429. The
 * handler receives a `stream` function to use instead of `streamArchive`: an
 * archive started through it owns the slot and gives it back when it ends,
 * fails, is cancelled or stalls. If the handler answers any other way (a
 * refusal, a throw), the slot is given back here.
 *
 * The client key is `getClientIp()`, so it honours `TRUSTED_PROXY_HOPS` like
 * the rate limiter.
 */
export async function withArchiveSlot(
  request: NextRequest,
  handler: (stream: ArchiveStreamer) => Promise<Response>,
): Promise<Response> {
  const release = acquireArchiveSlot(getClientIp(request));
  if (!release) return refusal(request, 429, 'rateLimited', ARCHIVE_SLOT_RETRY_AFTER);

  let handedOver = false;
  try {
    return await handler((albumName, assets) => {
      const response = streamArchive(albumName, assets, release);
      handedOver = true;
      return response;
    });
  } finally {
    if (!handedOver) release();
  }
}

/**
 * Stream `assets` as a ZIP of originals, without their location metadata
 * (lib/locationScrub.ts).
 *
 * archiver writes data descriptors, so entry sizes are never known up front and
 * memory stays flat no matter how large the album is. The loop pulls one
 * original at a time and stops as soon as the response is gone.
 *
 * `onDone` runs exactly once, when the archive has been read to the end,
 * failed, been cancelled or stalled; `withArchiveSlot` hands its slot release
 * in here.
 */
export function streamArchive(
  albumName: string,
  assets: ImmichAsset[],
  onDone: () => void = () => {},
): NextResponse {
  const archive = archiver('zip', { store: true });
  archive.on('error', (err) => {
    // A visitor cancelling the download is not a failure worth a log line.
    if (err.name === 'AbortError') return;
    console.error(`[Download] Archive stream failed:`, err);
  });

  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  const finish = () => {
    clearTimeout(stallTimer);
    if (done) return;
    done = true;
    onDone();
  };
  // Every way an archive ends passes through `close`: read to the end,
  // destroyed by an error, by a cancel, or by the stall timer below.
  archive.once('close', finish);

  // A pull-based body rather than `Readable.toWeb()`: `pull` runs only once
  // the client has taken what was queued, which is the signal the stall timer
  // needs. The queue holds a single chunk; archiver's own buffer and
  // backpressure do the rest, as before.
  const chunks = archive[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        clearTimeout(stallTimer);
        try {
          const next = await chunks.next();
          if (next.done) {
            controller.close();
            finish();
            return;
          }
          // A Buffer is a Uint8Array: handed on as is, not copied.
          controller.enqueue(next.value);
        } catch (err) {
          // Also reached when a cancel won the race: erroring a cancelled
          // stream is a no-op.
          controller.error(err);
          finish();
          return;
        }
        if (done) return;
        // The chunk is queued; the next move is the client's.
        stallTimer = setTimeout(() => {
          console.warn(
            `[Download] Archive closed: nothing read for ${ARCHIVE_STALL_TIMEOUT_MS / 1000}s`,
          );
          controller.error(new Error('Archive download stalled'));
          // Destroys the entry in flight and with it the upstream body
          // (appendEntry), and stops the fill loop.
          archive.destroy();
          finish();
        }, ARCHIVE_STALL_TIMEOUT_MS);
        stallTimer.unref?.();
      },
      cancel() {
        // The visitor left: tear the archive down, upstream body included.
        archive.destroy();
        finish();
      },
    },
    { highWaterMark: 1 },
  );

  // Fill the archive in the background: the response has to go out first so the
  // browser starts reading, and each originals fetch is awaited in turn.
  void (async () => {
    try {
      const used = new Set<string>();
      // Originals refused by the location scrubber. The ZIP carries on without
      // them, so the count is the only trace a visitor's archive came up short.
      let dropped = 0;
      for (const asset of assets) {
        // The visitor left (or the archive failed): stop pulling originals.
        if (archive.destroyed) break;
        // Edited in Immich: the edit, not the unedited camera file (#831).
        const edited = asset.isEdited === true;
        const result = await immich.streamAsset(asset.id, 'original', edited);
        if (!result) continue;
        if (archive.destroyed) {
          // Left while the headers were on their way: release the body unread.
          await result.stream.cancel();
          break;
        }
        // Location out, as for the single download. Only the head of each
        // original is held while its metadata is found, so memory stays flat.
        const scrubbed = await scrubLocationStream(result.stream as ReadableStream<Uint8Array>);
        if (!scrubbed.ok) {
          dropped++;
          console.warn(
            `[Download] Left asset ${asset.id} out of the archive "${albumName}": its location metadata could not be removed (${scrubbed.reason}).`,
          );
          continue;
        }
        // An edited photo's rendition is expected as JPEG (#831); one the
        // scrubber passes through untouched stays out, as for the single
        // download.
        if (edited && scrubbed.format === 'passthrough') {
          dropped++;
          await scrubbed.stream.cancel().catch(() => {});
          console.warn(
            `[Download] Left edited asset ${asset.id} out of the archive "${albumName}": Immich sent ${result.contentType || 'no type'}, which is not a JPEG or HEIF-family file.`,
          );
          continue;
        }
        if (archive.destroyed) {
          await scrubbed.stream.cancel();
          break;
        }
        const nodeStream = Readable.fromWeb(
          scrubbed.stream as unknown as import('node:stream/web').ReadableStream,
        );
        await appendEntry(
          archive,
          nodeStream,
          uniqueEntryName(
            edited
              ? editedDownloadName(asset.originalFileName, result.contentType)
              : asset.originalFileName,
            used,
          ),
          entryDate(asset),
        );
      }
      if (dropped) {
        console.warn(
          `[Download] Archive "${albumName}" is missing ${dropped} of ${assets.length} originals; see the lines above for the asset IDs.`,
        );
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
