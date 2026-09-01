/**
 * Filenames for downloaded originals (#475).
 *
 * The name comes from Immich, which took it from the camera or from whatever
 * the photographer typed - so it is untrusted input on its way into a
 * `Content-Disposition` header. A newline in it would end the header and let
 * the rest be read as headers of its own; a path separator would suggest a
 * directory to the browser.
 */

/**
 * Drop control characters, including the CR and LF that would end a header.
 *
 * Written as a code-point filter rather than a regular expression: a character
 * class of escaped control codes is the kind of source line that gets mangled
 * by an editor or a copy-paste and then silently stops matching.
 */
function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');
}

/** True for printable ASCII, the range the pre-RFC-5987 filename is limited to. */
function isPrintableAscii(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= 32 && code <= 126;
}

/**
 * A filename safe to put in a `Content-Disposition` header.
 *
 * Strips anything that could break out of the header or out of the download
 * directory, then falls back to a generic name if nothing usable is left - an
 * empty filename would make the browser invent one from the URL, which is the
 * opaque token.
 */
export function safeDownloadName(raw: string | undefined, fallback = 'photo'): string {
  const cleaned = stripControlChars(raw ?? '')
    // Directory separators and traversal.
    .replace(/[/\\]/g, '_')
    // Quotes and semicolons delimit the header's own parameters.
    .replace(/["';]/g, '')
    .replace(/^\.+/, '')
    .trim();

  if (!cleaned) return fallback;
  // Long names are the browser's problem, but an unbounded one is ours.
  return cleaned.slice(0, 200);
}

/**
 * A full `Content-Disposition` value.
 *
 * Emits both `filename` and `filename*`: the plain parameter is stripped to
 * ASCII for clients that predate RFC 5987, and the starred one carries the
 * real name percent-encoded for everything since.
 */
export function contentDisposition(name: string | undefined): string {
  const safe = safeDownloadName(name);
  const ascii =
    Array.from(safe)
      .map((character) => (isPrintableAscii(character) ? character : '_'))
      .join('') || 'photo';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

/**
 * The filename carried by a `Content-Disposition` header, or null.
 *
 * Client-safe (no `fs`/`crypto`): the proofing modal reads this off a download
 * response so a ZIP fetched in the browser keeps the name the server chose
 * rather than inventing a second one. Prefers the RFC 5987 `filename*` value,
 * which preserves non-ASCII names.
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? null;
}
