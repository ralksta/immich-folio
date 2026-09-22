/**
 * Journal & Storytelling Types, Parser and Serializer.
 * Client-safe pure TypeScript module (no Node.js fs dependencies).
 */

export interface JournalFrontmatter {
  title?: string;
  subtitle?: string;
  date?: string;
  author?: string;
  coverAssetId?: string;
  layout?: string;
  password?: string;
  draft?: boolean;
}

export type JournalBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; html: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'photo'; assetId: string; caption?: string; layout: 'fullbleed' | 'wide' | 'contained' }
  | { type: 'photo-pair'; assetIds: [string, string]; caption?: string }
  | { type: 'photo-grid'; assetIds: string[]; caption?: string }
  | { type: 'facts'; items: Array<{ label: string; value: string }> }
  | { type: 'map'; caption?: string; line: boolean; items: MapItem[]; pins?: MapPin[] }
  | {
      /**
       * "x photos from an album". Expanded on the server into photo blocks
       * (lib/journalAlbum.ts) before the page renders, so the client never
       * sees this type; the studio expands it through the admin assets route.
       */
      type: 'album';
      albumId: string;
      count?: number;
      skip?: number;
      layout: AlbumBlockLayout;
      caption?: string;
    };

export type AlbumBlockLayout = 'grid' | 'pairs' | 'wide';

/**
 * What an author puts on a journal map, in the order the line is drawn.
 * A typed point is published as typed. A photo item is placed by its EXIF
 * position under the album's `location:` precision; `all-photos` expands to
 * every geotagged photo of the entry not already listed.
 */
export type MapItem =
  | { kind: 'point'; label?: string; lat: number; lng: number }
  | { kind: 'photo'; assetId: string }
  | { kind: 'all-photos' };

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/**
 * A position on a journal map. Never authored and never serialized: the
 * server derives pins from the entry's own geotagged photos at render time
 * (lib/journalMap.ts), already quantised to the album's `location:` setting.
 */
export interface MapPin {
  lat: number;
  lng: number;
  label?: string;
}

export interface ParsedJournal {
  frontmatter: JournalFrontmatter;
  blocks: JournalBlock[];
  referencedAssetIds: string[];
}

/**
 * Every asset id a block refers to, in block order, without duplicates.
 * An empty id is an unfilled placeholder (the block editor's "+ Pick" tile),
 * not a reference — it is skipped so nothing probes or renders it.
 */
export function collectAssetIds(blocks: readonly JournalBlock[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type === 'photo') {
      if (block.assetId) ids.add(block.assetId);
    } else if (block.type === 'photo-pair' || block.type === 'photo-grid') {
      for (const id of block.assetIds) if (id) ids.add(id);
    } else if (block.type === 'map') {
      for (const item of block.items)
        if (item.kind === 'photo' && item.assetId) ids.add(item.assetId);
    }
  }
  return Array.from(ids);
}

/**
 * The same block with every asset id passed through `fn` — the one place that
 * knows which block types carry ids, so the page that swaps raw UUIDs for
 * tokens does not grow a branch per type.
 */
export function mapBlockAssetIds(block: JournalBlock, fn: (id: string) => string): JournalBlock {
  switch (block.type) {
    case 'photo':
      return { ...block, assetId: fn(block.assetId) };
    case 'photo-pair':
      return { ...block, assetIds: [fn(block.assetIds[0]), fn(block.assetIds[1])] };
    case 'photo-grid':
      return { ...block, assetIds: block.assetIds.map(fn) };
    case 'map':
      return {
        ...block,
        items: block.items.map((item) =>
          item.kind === 'photo' ? { ...item, assetId: fn(item.assetId) } : item,
        ),
      };
    default:
      return block;
  }
}

export interface JournalEntrySummary {
  slug: string;
  filename: string;
  frontmatter: JournalFrontmatter;
  excerpt: string;
  wordCount: number;
  readingTimeMinutes: number;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Make an author's text inert as HTML.
 *
 * This escapes rather than filters. The previous implementation stripped
 * `<script>` tags, `on*="..."` handlers and the literal string `javascript:`,
 * which is a denylist and was trivially bypassable: `<img src=x onerror=alert(1)>`
 * (unquoted handler), `onerror='...'` (single quotes), `<svg onload=...>` (not a
 * script tag) and `javasjavascript:cript:` (the replacement recombines) all
 * passed through into `dangerouslySetInnerHTML`.
 *
 * With escaping there is nothing to enumerate: the only tags in the output are
 * the ones renderInlineMarkdown emits itself.
 */
export function sanitizeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Reverse of sanitizeHtml, for turning rendered block HTML back into Markdown.
 * Without this a save would write `&lt;` into the file and the next parse would
 * escape the `&` again, corrupting the text a little more on every round trip.
 */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Schemes an author may link to. Everything else — `javascript:`, `data:`,
 * `vbscript:` — renders as plain text instead of an anchor.
 */
const SAFE_URL = /^(?:https?:\/\/|mailto:|tel:|[./#])/i;

function isSafeUrl(url: string): boolean {
  // Browsers ignore control characters and whitespace inside a scheme, so
  // `java\tscript:` would run. Strip them before deciding.
  return SAFE_URL.test(url.replace(/[\u0000-\u0020]/g, ''));
}

/** Sanitize a slug to only allow safe URL and filesystem characters */
export function isValidSlug(slug: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(slug) && !slug.includes('..');
}

export function sanitizeSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled'
  );
}

/** Simple Markdown inline formatting (bold, italic, links) */
export function renderInlineMarkdown(text: string): string {
  // Escape first: from here on every `<` and `"` in the string is the author's
  // literal text, so the markdown rules below can only ever add the tags they
  // build themselves, and a URL cannot break out of its href attribute.
  let html = sanitizeHtml(text);
  // Bold: **text** or __text__
  //
  // CodeQL flags the lazy group here as polynomial backtracking. It is left as
  // is on purpose: rewriting it with a negated class (`\*\*([^*]+)\*\*`) removes
  // the backtracking but also breaks nesting — `**bold *and italic* here**`
  // then renders as `*<em>bold </em>and italic<em> here</em>*`. The input is
  // Markdown written by an authenticated admin, never visitor input, so the
  // worst case is an author slowing down their own page.
  // `**bold**` works anywhere; `__bold__` only outside a word, matching
  // CommonMark's intraword rule for `_` — otherwise `my_file_name` round-trips
  // through `<em>` and comes back with asterisks in the middle of a word.
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<![\w])__(.*?)__(?![\w])/g, '<strong>$1</strong>');
  // Italic: *text* or _text_, same intraword rule for `_`.
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/(?<![\w])_(.*?)_(?![\w])/g, '<em>$1</em>');
  // Links: [label](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const trimmed = url.trim();
    if (!isSafeUrl(trimmed)) return label;
    return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return html;
}

/**
 * Inverse of renderInlineMarkdown: walks the `<strong>`/`<em>`/`<a href>` tags
 * it produces (and only those — anything else is dropped, keeping its
 * content, matching what the previous flat regex did for unknown tags) back
 * into their Markdown source, recursing so a link around bold text, or bold
 * text around a link, both come back correctly. Entities are decoded once at
 * the end, since every text run and the `href` value are the only places
 * they appear — the markdown syntax this function adds is never itself
 * entity-escaped.
 */
function inlineHtmlToMarkdownRaw(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<') {
      out += html[i];
      i++;
      continue;
    }

    const openMatch = /^<(\w+)([^>]*)>/.exec(html.slice(i));
    if (!openMatch) {
      out += html[i];
      i++;
      continue;
    }
    const [full, tagName, attrs] = openMatch;

    // Find this tag's matching close, tracking nested opens of the same tag.
    const closeTag = `</${tagName}>`;
    let depth = 1;
    let scan = i + full.length;
    let closeAt = -1;
    while (scan < html.length) {
      const nextClose = html.indexOf(closeTag, scan);
      if (nextClose === -1) break;
      const nextOpen = html.indexOf(`<${tagName}`, scan);
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        scan = nextOpen + 1;
      } else {
        depth--;
        scan = nextClose + closeTag.length;
        if (depth === 0) {
          closeAt = nextClose;
          break;
        }
      }
    }

    if (closeAt === -1) {
      // Unmatched tag: not something this renderer produces, pass it through
      // as literal text rather than losing it.
      out += html[i];
      i++;
      continue;
    }

    const innerMd = inlineHtmlToMarkdownRaw(html.slice(i + full.length, closeAt));
    if (tagName === 'strong' || tagName === 'b') out += `**${innerMd}**`;
    else if (tagName === 'em' || tagName === 'i') out += `*${innerMd}*`;
    else if (tagName === 'a') {
      const href = /\shref="([^"]*)"/.exec(attrs)?.[1] ?? '';
      out += `[${innerMd}](${href})`;
    } else {
      out += innerMd;
    }
    i = closeAt + closeTag.length;
  }
  return out;
}

export function inlineHtmlToMarkdown(html: string): string {
  return decodeHtmlEntities(inlineHtmlToMarkdownRaw(html));
}

const isWhitespace = (char: string) => char.trim() === '';

/**
 * Split `Quote -- Author` at the first separator surrounded by whitespace.
 *
 * A plain scan rather than a pattern. The original `/^(.*?)(?:\s+--\s+(.+))?$/`
 * wrapped a lazy group around an optional one — the quadratic case — and its
 * first replacement, `/\s+--\s+/`, was reported as polynomial backtracking in
 * turn. This is linear and needs no reasoning about the engine at all.
 */
export function splitQuoteAuthor(text: string): { body: string; author?: string } {
  for (
    let hyphens = text.indexOf('--');
    hyphens !== -1;
    hyphens = text.indexOf('--', hyphens + 2)
  ) {
    let start = hyphens;
    while (start > 0 && isWhitespace(text[start - 1])) start--;

    let end = hyphens + 2;
    while (end < text.length && isWhitespace(text[end])) end++;

    // Whitespace is required on both sides, so `a--b` is not a separator.
    if (start === hyphens || end === hyphens + 2) continue;

    return { body: text.slice(0, start), author: text.slice(end).trim() || undefined };
  }

  return { body: text };
}

/** Parse frontmatter (YAML block delimited by ---) */
export function parseFrontmatter(content: string): {
  frontmatter: JournalFrontmatter;
  body: string;
} {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const rawYaml = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);
  const frontmatter: JournalFrontmatter = {};

  for (const line of rawYaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
      // Undo the escaping serializeJournalMarkdown applies. Without this a title
      // containing a quote or a backslash gained one more backslash on every
      // save/load cycle.
      val = val.slice(1, -1).replace(/\\([\\"])/g, '$1');
    } else if (val.length >= 2 && val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }

    if (key === 'title') frontmatter.title = val;
    else if (key === 'subtitle') frontmatter.subtitle = val;
    else if (key === 'date') frontmatter.date = val;
    else if (key === 'author') frontmatter.author = val;
    else if (key === 'coverAssetId') frontmatter.coverAssetId = val;
    else if (key === 'layout') frontmatter.layout = val;
    else if (key === 'password') frontmatter.password = val;
    else if (key === 'draft') frontmatter.draft = val === 'true' || val === '1';
  }

  return { frontmatter, body };
}

/** Parse Journal Markdown content into structured blocks */
export function parseJournalMarkdown(rawContent: string): ParsedJournal {
  const { frontmatter, body } = parseFrontmatter(rawContent);
  const blocks: JournalBlock[] = [];

  // Split body into paragraph chunks separated by blank lines
  const chunks = body
    .split(/\r?\n\s*\r?\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    // 0a. Map: `::map Caption`, then one line per pin in drawing order —
    //     `Label: lat, lng` or `lat, lng` for a typed point, `photo: <id>` for
    //     a photo placed by its GPS, `photos: all` for every geotagged photo
    //     of the entry, `line: off` to drop the connecting line. Pins are
    //     never in the file — see MapPin. Malformed lines are ignored.
    const [mapFirst, ...mapRest] = chunk.split('\n');
    const mapMatch = mapFirst.match(/^::map(?:[ \t]+(\S.*))?[ \t]*$/);
    if (mapMatch) {
      const caption = mapMatch[1]?.trim();
      const items: MapItem[] = [];
      let line = true;
      const coords = (s: string) => {
        const m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (!m) return null;
        const lat = Number(m[1]);
        const lng = Number(m[2]);
        return isValidCoordinate(lat, lng) ? { lat, lng } : null;
      };
      for (const raw of mapRest) {
        const text = raw.trim();
        if (!text) continue;
        const colon = text.indexOf(':');
        const key = colon === -1 ? '' : text.slice(0, colon).trim();
        const value = colon === -1 ? text : text.slice(colon + 1).trim();
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'line') {
          line = !['off', 'false', 'no', '0'].includes(value.toLowerCase());
        } else if (lowerKey === 'photos') {
          if (value.toLowerCase() === 'all') items.push({ kind: 'all-photos' });
        } else if (lowerKey === 'photo') {
          for (const id of value.split(',')) {
            const assetId = id.trim();
            if (assetId) items.push({ kind: 'photo', assetId });
          }
        } else {
          const pos = coords(value);
          if (pos)
            items.push(key ? { kind: 'point', label: key, ...pos } : { kind: 'point', ...pos });
        }
      }
      blocks.push({
        type: 'map',
        caption: caption ? renderInlineMarkdown(caption) : undefined,
        line,
        items,
      });
      continue;
    }

    // 0b. Facts: a `::facts` line, then `Label: Value` lines in the same chunk.
    //    `::` because `![facts]` would read as a legacy photo reference and `#`
    //    and `>` are taken; no paragraph starts that way. The first colon
    //    splits, so `Time: 08:30` keeps its value. Lines without one, or with
    //    an empty side, are ignored.
    if (chunk.startsWith('::facts')) {
      const items = chunk
        .split('\n')
        .slice(1)
        .flatMap((line) => {
          const colon = line.indexOf(':');
          if (colon === -1) return [];
          const label = line.slice(0, colon).trim();
          const value = line.slice(colon + 1).trim();
          return label && value ? [{ label, value: renderInlineMarkdown(value) }] : [];
        });
      blocks.push({ type: 'facts', items });
      continue;
    }

    // 0c. Album: `::album <id>` with `count:`, `skip:`, `layout:` and
    //     `caption:` lines. An empty id is the studio's unfilled placeholder.
    const [albumFirst, ...albumRest] = chunk.split('\n');
    const albumMatch = albumFirst.match(/^::album(?:[ \t]+(\S+))?[ \t]*$/);
    if (albumMatch) {
      let count: number | undefined;
      let skip: number | undefined;
      let layout: AlbumBlockLayout = 'grid';
      let caption: string | undefined;
      for (const raw of albumRest) {
        const colon = raw.indexOf(':');
        if (colon === -1) continue;
        const key = raw.slice(0, colon).trim().toLowerCase();
        const value = raw.slice(colon + 1).trim();
        if (key === 'count' && /^\d+$/.test(value)) count = Number(value);
        else if (key === 'skip' && /^\d+$/.test(value)) skip = Number(value);
        else if (key === 'layout' && (value === 'grid' || value === 'pairs' || value === 'wide'))
          layout = value;
        else if (key === 'caption' && value) caption = renderInlineMarkdown(value);
      }
      blocks.push({
        type: 'album',
        albumId: albumMatch[1] ?? '',
        ...(count !== undefined ? { count } : {}),
        ...(skip ? { skip } : {}),
        layout,
        ...(caption ? { caption } : {}),
      });
      continue;
    }

    // 1. Headings (# H1, ## H2, ### H3)
    // `[ \t]+` rather than `\s+`: next to `(.+)` the two overlap, and the
    // engine has to try every split of the whitespace run before failing.
    const headingMatch = chunk.match(/^(#{1,6})[ \t]+(\S.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    // 2. Blockquote (> Quote text)
    if (chunk.startsWith('>')) {
      const quoteText = chunk
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join(' ')
        .trim();

      const { body: quoteBody, author: quoteAuthor } = splitQuoteAuthor(quoteText);

      blocks.push({
        type: 'quote',
        text: renderInlineMarkdown(quoteBody),
        author: quoteAuthor,
      });
      continue;
    }

    // 3. Image syntax: ![assetId:layout](Caption), ![id1, id2](Caption) for a
    //    pair, ![id1, id2, id3, …](Caption) for a grid
    //
    // The bracket group allows zero characters (`*`, not `+`) so a template's
    // unfilled placeholder — `assetId: ''`, serialized as `![](Caption)` or
    // `![:wide](Caption)` — still parses back into a `photo` block instead of
    // silently degrading into a text paragraph on the next load.
    const imgMatch = chunk.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
    if (imgMatch) {
      const rawTarget = imgMatch[1].trim();
      const caption = imgMatch[2].trim() ? renderInlineMarkdown(imgMatch[2].trim()) : undefined;

      // Two ids are a side-by-side pair, three or more a grid. The pair used
      // to take the first two of any count and drop the rest on the next save.
      if (rawTarget.includes(',')) {
        const parts = rawTarget.split(',').map((s) => s.trim());
        if (parts.length >= 3) {
          blocks.push({ type: 'photo-grid', assetIds: parts, caption });
          continue;
        }
        if (parts.length === 2) {
          blocks.push({
            type: 'photo-pair',
            assetIds: [parts[0], parts[1]],
            caption,
          });
          continue;
        }
      }

      // Single photo: ![assetId:layout](Caption)
      let assetId = rawTarget;
      let layout: 'fullbleed' | 'wide' | 'contained' = 'contained';

      if (rawTarget.includes(':')) {
        const [id, l] = rawTarget.split(':');
        assetId = id.trim();
        const normLayout = l.trim().toLowerCase();
        if (normLayout === 'fullbleed') layout = 'fullbleed';
        else if (normLayout === 'wide') layout = 'wide';
      }

      blocks.push({
        type: 'photo',
        assetId,
        caption,
        layout,
      });
      continue;
    }

    // 4. Standard Text Paragraph
    blocks.push({
      type: 'paragraph',
      html: renderInlineMarkdown(chunk.replace(/\r?\n/g, ' ')),
    });
  }

  // The cover comes first, as before; collectAssetIds() skips '' placeholders.
  const referencedAssetIds = Array.from(
    new Set([
      ...(frontmatter.coverAssetId ? [frontmatter.coverAssetId] : []),
      ...collectAssetIds(blocks),
    ]),
  );

  return { frontmatter, blocks, referencedAssetIds };
}

/** Converts a ParsedJournal structure back into clean Markdown syntax */
export function serializeJournalMarkdown(journal: ParsedJournal): string {
  const lines: string[] = [];

  // Frontmatter
  const fmKeys = Object.keys(journal.frontmatter) as Array<keyof JournalFrontmatter>;
  if (
    fmKeys.length > 0 &&
    fmKeys.some((k) => journal.frontmatter[k] !== undefined && journal.frontmatter[k] !== '')
  ) {
    lines.push('---');
    for (const key of fmKeys) {
      const val = journal.frontmatter[key];
      if (val !== undefined && val !== '') {
        if (typeof val === 'boolean') {
          lines.push(`${key}: ${val}`);
        } else {
          const escaped = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          lines.push(`${key}: "${escaped}"`);
        }
      }
    }
    lines.push('---');
    lines.push('');
  }

  // Blocks
  for (const block of journal.blocks) {
    switch (block.type) {
      case 'heading': {
        const hashes = '#'.repeat(Math.min(Math.max(block.level, 1), 6));
        lines.push(`${hashes} ${block.text}`);
        break;
      }
      case 'paragraph': {
        lines.push(inlineHtmlToMarkdown(block.html));
        break;
      }
      case 'quote': {
        const authorSuffix = block.author ? ` -- ${block.author}` : '';
        const text = inlineHtmlToMarkdown(block.text.replace(/[\r\n]+/g, ' '));
        lines.push(`> ${text}${authorSuffix}`);
        break;
      }
      case 'photo': {
        const layoutSuffix = block.layout !== 'contained' ? `:${block.layout}` : '';
        const caption = block.caption
          ? inlineHtmlToMarkdown(block.caption.replace(/[\r\n]+/g, ' '))
          : '';
        lines.push(`![${block.assetId}${layoutSuffix}](${caption})`);
        break;
      }
      case 'photo-pair': {
        const caption = block.caption
          ? inlineHtmlToMarkdown(block.caption.replace(/[\r\n]+/g, ' '))
          : '';
        lines.push(`![${block.assetIds[0]}, ${block.assetIds[1]}](${caption})`);
        break;
      }
      case 'photo-grid': {
        const caption = block.caption
          ? inlineHtmlToMarkdown(block.caption.replace(/[\r\n]+/g, ' '))
          : '';
        lines.push(`![${block.assetIds.join(', ')}](${caption})`);
        break;
      }
      case 'map': {
        const caption = block.caption
          ? inlineHtmlToMarkdown(block.caption.replace(/[\r\n]+/g, ' ')).trim()
          : '';
        lines.push(caption ? `::map ${caption}` : '::map');
        for (const item of block.items) {
          if (item.kind === 'all-photos') lines.push('photos: all');
          else if (item.kind === 'photo') {
            if (item.assetId) lines.push(`photo: ${item.assetId}`);
          } else if (isValidCoordinate(item.lat, item.lng)) {
            const label = item.label?.replace(/[\r\n]+/g, ' ').trim();
            lines.push(label ? `${label}: ${item.lat}, ${item.lng}` : `${item.lat}, ${item.lng}`);
          }
        }
        if (!block.line) lines.push('line: off');
        break;
      }
      case 'album': {
        lines.push(block.albumId ? `::album ${block.albumId}` : '::album');
        if (block.count !== undefined) lines.push(`count: ${block.count}`);
        if (block.skip) lines.push(`skip: ${block.skip}`);
        if (block.layout !== 'grid') lines.push(`layout: ${block.layout}`);
        if (block.caption) {
          const caption = inlineHtmlToMarkdown(block.caption.replace(/[\r\n]+/g, ' ')).trim();
          if (caption) lines.push(`caption: ${caption}`);
        }
        break;
      }
      case 'facts': {
        lines.push('::facts');
        for (const item of block.items) {
          const label = item.label.trim();
          const value = inlineHtmlToMarkdown(item.value)
            .replace(/[\r\n]+/g, ' ')
            .trim();
          if (label && value) lines.push(`${label}: ${value}`);
        }
        break;
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/** Calculate approximate word count and reading time */
export function calculateReadingTime(text: string): { words: number; minutes: number } {
  const plainText = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    // Directive lines (`::facts`, `::map …`) are structure, not reading.
    .replace(/^::\w+.*$/gm, ' ');
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return { words, minutes };
}

/** Extract a brief plain-text excerpt from journal blocks */
export function extractExcerpt(parsed: ParsedJournal, maxLength = 160): string {
  if (parsed.frontmatter.subtitle) return parsed.frontmatter.subtitle;
  for (const block of parsed.blocks) {
    if (block.type === 'paragraph') {
      const text = block.html.replace(/<[^>]+>/g, '').trim();
      if (text) {
        return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
      }
    }
  }
  return '';
}
