import { describe, it, expect } from 'vitest';
import {
  calculateReadingTime,
  parseJournalMarkdown,
  renderInlineMarkdown,
  serializeJournalMarkdown,
} from '../journal';
import type { JournalBlock } from '../journal';

const ID = '3f1c9a52-8d4e-4b7a-9c1d-0e2f3a4b5c6d';
const ID2 = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const ID3 = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';

const serialize = (blocks: JournalBlock[]) =>
  serializeJournalMarkdown({ frontmatter: {}, blocks, referencedAssetIds: [] });
const roundTrip = (source: string) => serializeJournalMarkdown(parseJournalMarkdown(source));

/** No block that renders as text may carry an asset id. */
function expectNoIdInText(blocks: JournalBlock[], ids: string[]) {
  for (const block of blocks) {
    const text =
      block.type === 'paragraph'
        ? block.html
        : block.type === 'heading'
          ? block.text
          : block.type === 'quote'
            ? block.text
            : 'caption' in block
              ? (block.caption ?? '')
              : '';
    for (const id of ids) expect(text).not.toContain(id);
  }
}

/** Captions that broke, or could break, the `![…](…)` framing. */
const TRICKY_CAPTIONS = [
  'Gipfel (560 m)',
  '(560 m)',
  'Ende :)',
  'Anfang :(',
  '((doppelt))',
  ')',
  '(',
  'a) b (c',
  'Siehe [Karte](https://example.com/map_(1)) oben',
  '[Link](https://immich.app)',
  '**fett (mit Klammer)** und *kursiv*',
  'eckige [Klammern] ohne Link',
  '] mitten [',
  'Pfad C:\\Fotos\\',
  'Backslash vor Klammer \\) und \\(',
  'Emoji 🏔️ (Gipfel) 📷',
  'Umlaute: Größe, Übersicht, Äpfel (Öl)',
  'Anna\'s "Zitat" & <Tag>',
  '![verschachtelt](nicht wirklich)',
];

describe('photo captions with parentheses (A-1)', () => {
  it('keeps a wide photo with `(560 m)` in its caption a photo block', () => {
    const source = `![${ID}:wide](Gipfel (560 m))`;
    const parsed = parseJournalMarkdown(source);
    expect(parsed.blocks).toEqual([
      { type: 'photo', assetId: ID, layout: 'wide', caption: 'Gipfel (560 m)' },
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it('keeps pair and grid captions with parentheses intact', () => {
    const pair = `![${ID}, ${ID2}](Links (Nord), rechts (Süd))`;
    expect(parseJournalMarkdown(pair).blocks[0]).toEqual({
      type: 'photo-pair',
      assetIds: [ID, ID2],
      caption: 'Links (Nord), rechts (Süd)',
    });
    expect(roundTrip(pair)).toBe(pair);

    const grid = `![${ID}, ${ID2}, ${ID3}](Drei (3))`;
    expect(parseJournalMarkdown(grid).blocks[0]).toEqual({
      type: 'photo-grid',
      assetIds: [ID, ID2, ID3],
      caption: 'Drei (3)',
    });
    expect(roundTrip(grid)).toBe(grid);
  });

  it('renders a link inside a caption', () => {
    const parsed = parseJournalMarkdown(`![${ID}](Mehr auf [Immich](https://immich.app))`);
    expect(parsed.blocks[0]).toMatchObject({
      type: 'photo',
      caption:
        'Mehr auf <a href="https://immich.app" target="_blank" rel="noopener noreferrer">Immich</a>',
    });
  });

  it('keeps balanced parentheses inside a link URL', () => {
    const source = `![${ID}:wide](Gipfel (560 m), siehe [Karte](https://example.com/map_(1)))`;
    const parsed = parseJournalMarkdown(source);
    expect(parsed.blocks[0]).toMatchObject({
      type: 'photo',
      caption:
        'Gipfel (560 m), siehe <a href="https://example.com/map_(1)" target="_blank" rel="noopener noreferrer">Karte</a>',
    });
    expect(roundTrip(source)).toBe(source);
    // Outside a link, a parenthesis after the URL is still text.
    expect(renderInlineMarkdown('[a](https://x.y) (b)')).toBe(
      '<a href="https://x.y" target="_blank" rel="noopener noreferrer">a</a> (b)',
    );
  });

  for (const caption of TRICKY_CAPTIONS) {
    it(`round-trips the caption ${JSON.stringify(caption)} for every photo block type`, () => {
      const html = renderInlineMarkdown(caption);
      const blocks: JournalBlock[] = [
        { type: 'photo', assetId: ID, layout: 'fullbleed', caption: html },
        { type: 'photo', assetId: ID, layout: 'contained', caption: html },
        { type: 'photo-pair', assetIds: [ID, ID2], caption: html },
        { type: 'photo-grid', assetIds: [ID, ID2, ID3], caption: html },
      ];
      for (const block of blocks) {
        const once = serialize([block]);
        const parsed = parseJournalMarkdown(once);
        // The framing is exact: the caption comes back as the markdown that
        // was written, rendered once, and the block keeps its type and ids.
        expect(parsed.blocks).toHaveLength(1);
        const [back] = parsed.blocks;
        expect(back.type).toBe(block.type);
        expect(back).toMatchObject(
          block.type === 'photo'
            ? { assetId: ID, layout: block.layout }
            : { assetIds: 'assetIds' in block ? block.assetIds : [] },
        );
        const writtenCaption = once.slice(once.indexOf('](') + 2, -1);
        expect('caption' in back ? back.caption : undefined).toBe(
          renderInlineMarkdown(writtenCaption.trim()),
        );
        // And a second save writes the same file.
        expect(serialize(parsed.blocks)).toBe(once);
        expectNoIdInText(
          parsed.blocks.filter((b) => b.type === 'paragraph'),
          [ID, ID2, ID3],
        );
      }
    });
  }

  it('parses any single-line caption exactly (seeded fuzz)', () => {
    const alphabet = ['(', ')', '[', ']', '\\', '*', '_', ' ', 'a', 'Ü', '🏔️', '!', ':', ','];
    let seed = 0x5eed;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    for (let n = 0; n < 500; n++) {
      const length = next() % 24;
      let caption = '';
      for (let i = 0; i < length; i++) caption += alphabet[next() % alphabet.length];
      const source = `![${ID}:wide](${caption})`;
      const parsed = parseJournalMarkdown(source);
      expect(parsed.blocks).toHaveLength(1);
      expect(parsed.blocks[0]).toMatchObject({ type: 'photo', assetId: ID, layout: 'wide' });
      const expected = caption.trim() ? renderInlineMarkdown(caption.trim()) : undefined;
      expect((parsed.blocks[0] as { caption?: string }).caption).toBe(expected);
      // Idempotence of a save. Stray `*`/`_` runs are left out: the inline
      // emphasis renderer normalises those on its own (`__*` → `***`), which is
      // a property of renderInlineMarkdown, not of the photo-line framing.
      if (!/[*_]/.test(caption)) {
        const once = serializeJournalMarkdown(parsed);
        expect(roundTrip(once)).toBe(once);
      }
    }
  });
});

describe('photo lines the old pattern accepted parse exactly as before', () => {
  // The pattern before A-1, kept here as the reference for backward compatibility.
  const legacy = (line: string) => {
    const m = line.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
    return m ? { target: m[1].trim(), caption: m[2].trim() } : null;
  };

  const lines = [
    `![${ID}]()`,
    `![${ID}](Caption)`,
    `![${ID}:wide](A **bold** caption)`,
    `![${ID}:fullbleed](Offene Klammer (ohne Ende)`,
    `![${ID}, ${ID2}](Anna's photos)`,
    `![${ID}, ${ID2}, ${ID3}](Drei [eckige] Klammern)`,
    `![](Placeholder)`,
    `![:wide]()`,
    `![${ID}](C:\\)`,
    `![${ID}](a\\b \\( c)`,
    `![${ID}](Emoji 🏔️ Umlaut ä)`,
    `![${ID}](  Leerraum  )`,
  ];

  for (const line of lines) {
    it(JSON.stringify(line), () => {
      const old = legacy(line);
      expect(old).not.toBeNull();
      const blocks = parseJournalMarkdown(line).blocks;
      expect(blocks).toHaveLength(1);
      const expectedCaption = old!.caption ? renderInlineMarkdown(old!.caption) : undefined;
      expect((blocks[0] as { caption?: string }).caption).toBe(expectedCaption);
      const ids =
        blocks[0].type === 'photo'
          ? [blocks[0].assetId]
          : 'assetIds' in blocks[0]
            ? blocks[0].assetIds
            : [];
      expect(ids.join(', ')).toBe(old!.target.replace(/:(wide|fullbleed)$/, ''));
      // Unchanged content saves to the same line.
      expect(roundTrip(line)).toBe(roundTrip(roundTrip(line)));
    });
  }
});

describe('a malformed photo line never prints asset ids (A-1)', () => {
  it('splits two photo lines written without a blank line between them', () => {
    const parsed = parseJournalMarkdown(`![${ID}](Erstes)\n![${ID2}:wide](Zweites (2))`);
    expect(parsed.blocks).toEqual([
      { type: 'photo', assetId: ID, layout: 'contained', caption: 'Erstes' },
      { type: 'photo', assetId: ID2, layout: 'wide', caption: 'Zweites (2)' },
    ]);
  });

  it('splits a heading or sentence directly above a photo', () => {
    const parsed = parseJournalMarkdown(`## Tag 1\n![${ID}](Gipfel)`);
    expect(parsed.blocks).toEqual([
      { type: 'heading', level: 2, text: 'Tag 1' },
      { type: 'photo', assetId: ID, layout: 'contained', caption: 'Gipfel' },
    ]);

    const para = parseJournalMarkdown(`Wir stiegen auf.\n  ![${ID}, ${ID2}](Oben)`);
    expect(para.blocks.map((b) => b.type)).toEqual(['paragraph', 'photo-pair']);
    expectNoIdInText(para.blocks, [ID, ID2]);
  });

  it('keeps text after the closing parenthesis in the caption, not a paragraph', () => {
    const parsed = parseJournalMarkdown(`![${ID}](Gipfel) und weiter`);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0]).toMatchObject({ type: 'photo', assetId: ID });
    expectNoIdInText(parsed.blocks, [ID]);
    // Stable from the first save on.
    const once = roundTrip(`![${ID}](Gipfel) und weiter`);
    expect(roundTrip(once)).toBe(once);
  });

  it('treats a reference without a caption group as a photo', () => {
    for (const source of [`![${ID}]`, `![${ID}:wide] Text`, `![${ID}`]) {
      const parsed = parseJournalMarkdown(source);
      expect(parsed.blocks[0]).toMatchObject({ type: 'photo', assetId: ID });
      expectNoIdInText(parsed.blocks, [ID]);
    }
  });

  it('leaves directive chunks alone', () => {
    const parsed = parseJournalMarkdown(`::album abc\ncaption: ![x](y)`);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0]).toMatchObject({ type: 'album', albumId: 'abc' });
  });
});

describe('reading time ignores photo lines', () => {
  it('drops the whole line, parentheses in the caption included', () => {
    const { words } = calculateReadingTime(`Eins zwei.\n\n![${ID}](Gipfel (560 m) oben)`);
    expect(words).toBe(2);
  });
});
