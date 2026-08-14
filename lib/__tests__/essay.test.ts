import { describe, it, expect } from 'vitest';
import { parseEssayMarkdown, parseFrontmatter, sanitizeHtml, renderInlineMarkdown, serializeEssayMarkdown } from '../essay';

describe('Essay Parser', () => {
  it('sanitizes script tags to prevent XSS', () => {
    const input = 'Hello <script>alert("XSS")</script> World';
    // sanitizeHtml escapes rather than strips: the tag stays visible as the
    // author's literal text but can no longer be parsed as markup. Asserting
    // the old removed-substring output would assert the denylist that this
    // replaced.
    const out = sanitizeHtml(input);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('Hello');
    expect(out).toContain('World');
  });

  it('renders inline markdown formatting correctly', () => {
    const text = 'This is **bold** and *italic* with a [link](https://example.com)';
    const rendered = renderInlineMarkdown(text);
    expect(rendered).toContain('<strong>bold</strong>');
    expect(rendered).toContain('<em>italic</em>');
    expect(rendered).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>');
  });

  it('parses frontmatter correctly', () => {
    const markdown = `---
title: "The Icelandic Highlands"
subtitle: "A visual journey across black sand and glaciers"
author: "Ralf"
date: "2026-08-05"
coverAssetId: "asset-123"
---

# Section 1
First paragraph text.`;

    const { frontmatter, body } = parseFrontmatter(markdown);
    expect(frontmatter.title).toBe('The Icelandic Highlands');
    expect(frontmatter.subtitle).toBe('A visual journey across black sand and glaciers');
    expect(frontmatter.author).toBe('Ralf');
    expect(frontmatter.date).toBe('2026-08-05');
    expect(frontmatter.coverAssetId).toBe('asset-123');
    expect(body.trim()).toMatch(/^# Section 1/);
  });

  it('parses structured essay blocks (headings, quotes, photos, photo-pairs)', () => {
    const markdown = `---
title: "Test Story"
---

# Highland Sunrise

> Silence was absolute across the tundra. -- Ralf

![asset-1:fullbleed](Sunrise over the ridge)

![asset-2, asset-3](Side-by-side details)

A closing paragraph with **bold** details.`;

    const parsed = parseEssayMarkdown(markdown);
    expect(parsed.frontmatter.title).toBe('Test Story');
    expect(parsed.blocks.length).toBe(5);

    // Block 0: Heading
    expect(parsed.blocks[0]).toEqual({
      type: 'heading',
      level: 1,
      text: 'Highland Sunrise',
    });

    // Block 1: Quote
    expect(parsed.blocks[1]).toEqual({
      type: 'quote',
      text: 'Silence was absolute across the tundra.',
      author: 'Ralf',
    });

    // Block 2: Fullbleed Photo
    expect(parsed.blocks[2]).toEqual({
      type: 'photo',
      assetId: 'asset-1',
      caption: 'Sunrise over the ridge',
      layout: 'fullbleed',
    });

    // Block 3: Photo Pair
    expect(parsed.blocks[3]).toEqual({
      type: 'photo-pair',
      assetIds: ['asset-2', 'asset-3'],
      caption: 'Side-by-side details',
    });

    // Block 4: Paragraph
    expect(parsed.blocks[4].type).toBe('paragraph');
    if (parsed.blocks[4].type === 'paragraph') {
      expect(parsed.blocks[4].html).toContain('<strong>bold</strong>');
    }

    // Referenced Assets
    expect(parsed.referencedAssetIds).toContain('asset-1');
    expect(parsed.referencedAssetIds).toContain('asset-2');
    expect(parsed.referencedAssetIds).toContain('asset-3');
  });

  it('serializes structured essay blocks back to markdown', () => {
    const parsed = {
      frontmatter: { title: 'Story Title', author: 'Author' },
      blocks: [
        { type: 'heading' as const, level: 1, text: 'Chapter One' },
        { type: 'paragraph' as const, html: 'This is <strong>bold</strong> text.' },
        { type: 'quote' as const, text: 'A great quote', author: 'Person' },
        { type: 'photo' as const, assetId: 'photo-1', caption: 'Caption', layout: 'fullbleed' as const },
        { type: 'photo-pair' as const, assetIds: ['p1', 'p2'] as [string, string], caption: 'Pair caption' },
      ],
      referencedAssetIds: ['photo-1', 'p1', 'p2'],
    };

    const markdown = serializeEssayMarkdown(parsed);
    expect(markdown).toContain('title: "Story Title"');
    expect(markdown).toContain('# Chapter One');
    expect(markdown).toContain('This is **bold** text.');
    expect(markdown).toContain('> A great quote -- Person');
    expect(markdown).toContain('![photo-1:fullbleed](Caption)');
    expect(markdown).toContain('![p1, p2](Pair caption)');
  });
});
