import fs from 'fs';
import path from 'path';

export interface EssayFrontmatter {
  title?: string;
  subtitle?: string;
  date?: string;
  author?: string;
  coverAssetId?: string;
  layout?: string;
}

export type EssayBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; html: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'photo'; assetId: string; caption?: string; layout: 'fullbleed' | 'wide' | 'contained' }
  | { type: 'photo-pair'; assetIds: [string, string]; caption?: string };

export interface ParsedEssay {
  frontmatter: EssayFrontmatter;
  blocks: EssayBlock[];
  referencedAssetIds: string[];
}

/** Sanitize inline HTML strings to prevent XSS attacks in essay blocks */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
}

/** Simple Markdown inline formatting (bold, italic, links, code) */
export function renderInlineMarkdown(text: string): string {
  let html = sanitizeHtml(text);
  // Bold: **text** or __text__
  html = html.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  // Italic: *text* or _text_
  html = html.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
  // Links: [label](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const safeUrl = url.trim().replace(/^javascript:/i, '');
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return html;
}

/** Parse frontmatter (YAML block delimited by ---) */
export function parseFrontmatter(content: string): { frontmatter: EssayFrontmatter; body: string } {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const rawYaml = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);
  const frontmatter: EssayFrontmatter = {};

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
  }

  return { frontmatter, body };
}

/** Parse Essay Markdown content into structured blocks */
export function parseEssayMarkdown(rawContent: string): ParsedEssay {
  const { frontmatter, body } = parseFrontmatter(rawContent);
  const blocks: EssayBlock[] = [];
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

      // Check for quote author (-- Author Name)
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

/** Load and parse an essay file from content/essays/ */
export function loadEssayFromFile(filename: string): ParsedEssay | null {
  try {
    const filePath = path.isAbsolute(filename)
      ? filename
      : path.join(process.cwd(), 'content', 'essays', filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`[Essay] File not found: ${filePath}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseEssayMarkdown(content);
  } catch (error) {
    console.error(`[Essay] Failed to load essay file "${filename}":`, error);
    return null;
  }
}
