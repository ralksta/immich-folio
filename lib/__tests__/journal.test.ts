import { describe, it, expect, afterEach } from 'vitest';
import {
  parseJournalMarkdown,
  serializeJournalMarkdown,
  sanitizeHtml,
  renderInlineMarkdown,
  calculateReadingTime,
  extractExcerpt,
  isValidSlug,
  sanitizeSlug,
} from '../journal';
import {
  writeJournalEntry,
  readJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
} from '../admin/journal-service';

describe('Journal Service & Parser', () => {
  const testSlug = 'test-journey-nordkap';

  afterEach(async () => {
    try {
      await deleteJournalEntry(testSlug);
    } catch {}
  });

  describe('slug validation and sanitization', () => {
    it('validates safe alphanumeric and hyphenated slugs', () => {
      expect(isValidSlug('my-story-2026')).toBe(true);
      expect(isValidSlug('nordkap_journey')).toBe(true);
      expect(isValidSlug('story')).toBe(true);
    });

    it('rejects path traversal and illegal characters', () => {
      expect(isValidSlug('../etc/passwd')).toBe(false);
      expect(isValidSlug('..\\secret')).toBe(false);
      expect(isValidSlug('story/sub')).toBe(false);
      expect(isValidSlug('story?query=1')).toBe(false);
    });

    it('sanitizes titles to clean slugs', () => {
      expect(sanitizeSlug('Mein Trip nach Island & Co.!')).toBe('mein-trip-nach-island-co');
      expect(sanitizeSlug('  Nordkap 2026 -- Part 1  ')).toBe('nordkap-2026-part-1');
    });
  });

  describe('sanitizeHtml & inline markdown', () => {
    it('strips script tags and inline events', () => {
      const malicious = 'Hello <script>alert(1)</script><img src="x" onerror="alert(2)">';
      const clean = sanitizeHtml(malicious);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onerror');
    });

    it('formats bold, italic, and safe links', () => {
      const md = 'This is **bold** and *italic* and a [link](https://example.com).';
      const html = renderInlineMarkdown(md);
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<a href="https://example.com"');
    });
  });

  describe('parseJournalMarkdown and serializeJournalMarkdown', () => {
    it('parses frontmatter and structured blocks', () => {
      const markdown = `---
title: "Nordkap Tour"
subtitle: "Auf den Spuren des Nordlichts"
date: "2026-08-14"
author: "Ralf"
coverAssetId: "cover-uuid-1"
draft: true
---

# Kapitel 1: Die Reise beginnt

Es war ein stürmischer Tag am Fjord.

> Das Licht im Norden ist unvergleichlich. -- Ralf

![asset-uuid-2:fullbleed](Blick über den Fjord)

![pair-1, pair-2](Zwei Perspektiven)`;

      const parsed = parseJournalMarkdown(markdown);

      expect(parsed.frontmatter.title).toBe('Nordkap Tour');
      expect(parsed.frontmatter.subtitle).toBe('Auf den Spuren des Nordlichts');
      expect(parsed.frontmatter.draft).toBe(true);
      expect(parsed.frontmatter.coverAssetId).toBe('cover-uuid-1');

      expect(parsed.blocks).toHaveLength(5);
      expect(parsed.blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Kapitel 1: Die Reise beginnt' });
      expect(parsed.blocks[1]).toEqual({ type: 'paragraph', html: 'Es war ein stürmischer Tag am Fjord.' });
      expect(parsed.blocks[2]).toEqual({
        type: 'quote',
        text: 'Das Licht im Norden ist unvergleichlich.',
        author: 'Ralf',
      });
      expect(parsed.blocks[3]).toEqual({
        type: 'photo',
        assetId: 'asset-uuid-2',
        caption: 'Blick über den Fjord',
        layout: 'fullbleed',
      });
      expect(parsed.blocks[4]).toEqual({
        type: 'photo-pair',
        assetIds: ['pair-1', 'pair-2'],
        caption: 'Zwei Perspektiven',
      });

      expect(parsed.referencedAssetIds).toContain('cover-uuid-1');
      expect(parsed.referencedAssetIds).toContain('asset-uuid-2');
      expect(parsed.referencedAssetIds).toContain('pair-1');
      expect(parsed.referencedAssetIds).toContain('pair-2');
    });

    it('serializes parsed journal back to markdown', () => {
      const markdown = `---
title: "Nordkap"
draft: true
---

# Title

A paragraph of text.

![photo-uuid:wide](Caption)`;

      const parsed = parseJournalMarkdown(markdown);
      const serialized = serializeJournalMarkdown(parsed);

      expect(serialized).toContain('title: "Nordkap"');
      expect(serialized).toContain('draft: true');
      expect(serialized).toContain('# Title');
      expect(serialized).toContain('A paragraph of text.');
      expect(serialized).toContain('![photo-uuid:wide](Caption)');
    });
  });

  describe('filesystem CRUD operations', () => {
    it('writes, reads, lists and deletes journal files safely', async () => {
      const testContent = `---
title: "Vitest Journey"
date: "2026-08-14"
draft: false
---

Testing the journal filesystem operations.`;

      await writeJournalEntry(testSlug, testContent);

      const entry = await readJournalEntry(testSlug);
      expect(entry).not.toBeNull();
      expect(entry?.parsed.frontmatter.title).toBe('Vitest Journey');

      const all = await listJournalEntries();
      const found = all.find((e) => e.slug === testSlug);
      expect(found).toBeDefined();
      expect(found?.frontmatter.title).toBe('Vitest Journey');

      const deleted = await deleteJournalEntry(testSlug);
      expect(deleted).toBe(true);

      const checkAfter = await readJournalEntry(testSlug);
      expect(checkAfter).toBeNull();
    });
  });
});
