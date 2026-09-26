/**
 * Block-level Markdown for plain pages such as the privacy policy (#699):
 * headings, lists and paragraphs. Inline formatting goes through
 * renderInlineMarkdown, which escapes first, so the only tags in the output
 * are the ones built here and there.
 *
 * Deliberately small. The journal has its own block format; this is for a
 * text a person writes once and reads top to bottom.
 */

import { renderInlineMarkdown } from './journal';

export type MarkdownBlock =
  | { type: 'heading'; level: 2 | 3; html: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'paragraph'; html: string };

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', html: renderInlineMarkdown(paragraph.join(' ')) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ type: 'list', ...list });
      list = null;
    }
  };

  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);

    if (!line) {
      flush();
    } else if (heading) {
      flush();
      // The page title is the h1, so # and ## both become h2.
      blocks.push({
        type: 'heading',
        level: heading[1].length <= 2 ? 2 : 3,
        html: renderInlineMarkdown(heading[2]),
      });
    } else if (bullet || numbered) {
      const ordered = !!numbered;
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(renderInlineMarkdown((bullet ?? numbered)![1]));
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
