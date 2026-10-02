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

/** The extensions a rendition's content type is saved under; the first is used. */
const EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg', 'jpe', 'jfif'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'image/png': ['png'],
};

/**
 * The filename for a photo downloaded as edited in Immich (#831).
 *
 * Immich hands out an edited photo as a new rendition — a JPEG, measured
 * against Immich 3.2 — not as the stored file, so an iPhone's `IMG_0001.HEIC`
 * arrives as JPEG bytes. Keeping the name would leave a file the system opens
 * with the wrong program, or not at all; the extension is changed to match
 * what was sent. A name that already fits, or a type not listed here, is
 * left alone.
 */
export function editedDownloadName(
  name: string | undefined,
  contentType: string | null | undefined,
): string | undefined {
  const type = (contentType ?? '').toLowerCase().split(';')[0].trim();
  const extensions = EXTENSIONS[type];
  if (!name || !extensions) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const current = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return extensions.includes(current) ? name : `${stem}.${extensions[0]}`;
}
