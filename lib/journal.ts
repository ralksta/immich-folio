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
  | { type: 'photo-pair'; assetIds: [string, string]; caption?: string };

export interface ParsedJournal {
  frontmatter: JournalFrontmatter;
  blocks: JournalBlock[];
  referencedAssetIds: string[];
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
  html = html.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  // Italic: *text* or _text_
  html = html.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
  // Links: [label](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const trimmed = url.trim();
    if (!isSafeUrl(trimmed)) return label;
    return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return html;
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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
  const referencedAssetIds = new Set<string>();

  if (frontmatter.coverAssetId) {
    referencedAssetIds.add(frontmatter.coverAssetId);
  }

  // Split body into paragraph chunks separated by blank lines
  const chunks = body
    .split(/\r?\n\s*\r?\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    // 1. Headings (# H1, ## H2, ### H3)
    const headingMatch = chunk.match(/^(#{1,6})\s+(.+)$/);
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

      const authorMatch = quoteText.match(/^(.*?)(?:\s+--\s+(.+))?$/);
      if (authorMatch) {
        blocks.push({
          type: 'quote',
          text: renderInlineMarkdown(authorMatch[1]),
          author: authorMatch[2] ? authorMatch[2].trim() : undefined,
        });
      }
      continue;
    }

    // 3. Image syntax: ![assetId:layout](Caption) or ![assetId1, assetId2](Caption)
    const imgMatch = chunk.match(/^!\[([^\]]+)\]\(([^)]*)\)$/);
    if (imgMatch) {
      const rawTarget = imgMatch[1].trim();
      const caption = imgMatch[2].trim() ? renderInlineMarkdown(imgMatch[2].trim()) : undefined;

      // Side-by-side pair: ![asset1, asset2](Caption)
      if (rawTarget.includes(',')) {
        const parts = rawTarget.split(',').map((s) => s.trim());
        if (parts.length >= 2) {
          const id1 = parts[0];
          const id2 = parts[1];
          referencedAssetIds.add(id1);
          referencedAssetIds.add(id2);
          blocks.push({
            type: 'photo-pair',
            assetIds: [id1, id2],
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

      referencedAssetIds.add(assetId);
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

  return {
    frontmatter,
    blocks,
    referencedAssetIds: Array.from(referencedAssetIds),
  };
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
          lines.push(`${key}: "${String(val).replace(/"/g, '\\"')}"`);
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
        const text = block.html.replace(/<[^>]+>/g, (tag) => {
          if (tag.startsWith('<strong>') || tag.startsWith('<b>')) return '**';
          if (tag.startsWith('</strong>') || tag.startsWith('</b>')) return '**';
          if (tag.startsWith('<em>') || tag.startsWith('<i>')) return '*';
          if (tag.startsWith('</em>') || tag.startsWith('</i>')) return '*';
          return '';
        });
        lines.push(decodeHtmlEntities(text));
        break;
      }
      case 'quote': {
        const authorSuffix = block.author ? ` -- ${block.author}` : '';
        const text = decodeHtmlEntities(block.text.replace(/[\r\n]+/g, ' '));
        lines.push(`> ${text}${authorSuffix}`);
        break;
      }
      case 'photo': {
        const layoutSuffix = block.layout !== 'contained' ? `:${block.layout}` : '';
        const caption = block.caption
          ? decodeHtmlEntities(block.caption.replace(/[\r\n]+/g, ' '))
          : '';
        lines.push(`![${block.assetId}${layoutSuffix}](${caption})`);
        break;
      }
      case 'photo-pair': {
        const caption = block.caption ? block.caption.replace(/[\r\n]+/g, ' ') : '';
        lines.push(`![${block.assetIds[0]}, ${block.assetIds[1]}](${caption})`);
        break;
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/** Calculate approximate word count and reading time */
export function calculateReadingTime(text: string): { words: number; minutes: number } {
  const plainText = text.replace(/<[^>]+>/g, ' ').replace(/!\[.*?\]\(.*?\)/g, ' ');
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
