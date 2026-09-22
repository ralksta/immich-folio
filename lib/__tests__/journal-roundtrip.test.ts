import { describe, it, expect } from 'vitest';
import { parseJournalMarkdown, serializeJournalMarkdown } from '../journal';

/**
 * serializeJournalMarkdown must be the exact inverse of the inline renderer
 * for the constructs it produces, or a save silently rewrites the file (#628).
 */
const roundTrip = (source: string) => serializeJournalMarkdown(parseJournalMarkdown(source));

describe('journal round trip (#628)', () => {
  it('keeps a link through save', () => {
    const source = 'Read more at [Immich](https://immich.app) today.';
    const once = roundTrip(source);
    expect(once).toBe(source);
    expect(roundTrip(once)).toBe(once);
  });

  it('keeps emphasis inside a quote as markdown, not literal tags', () => {
    const source = '> **Yes** he said -- Someone';
    const once = roundTrip(source);
    expect(once).toBe(source);
    expect(once).not.toContain('<strong>');
  });

  it('keeps emphasis inside a photo caption as markdown', () => {
    const source = '![abc123:wide](A **bold** caption)';
    const once = roundTrip(source);
    expect(once).toBe(source);
  });

  it('does not double-encode an apostrophe in a photo-pair caption', () => {
    const source = "![abc123, def456](Anna's photos)";
    const once = roundTrip(source);
    expect(once).toBe(source);
    expect(roundTrip(once)).toBe(once);
  });

  it('leaves intraword underscores alone', () => {
    const source = 'See my_photo_2024.jpg for details.';
    const once = roundTrip(source);
    expect(once).toBe(source);
  });

  it('still renders underscore emphasis with word boundaries either side', () => {
    const source = 'This is _emphasised_ text.';
    const parsed = parseJournalMarkdown(source);
    expect(parsed.blocks[0]).toMatchObject({
      type: 'paragraph',
      html: 'This is <em>emphasised</em> text.',
    });
    // `_` and `*` both parse to <em>, so a `_`-emphasised word comes back with
    // `*` — that normalisation is expected. What must hold is idempotence.
    const once = roundTrip(source);
    expect(roundTrip(once)).toBe(once);
  });

  it('round-trips a link nested inside bold text', () => {
    const source = '**[Immich](https://immich.app)** is great.';
    const once = roundTrip(source);
    expect(once).toBe(source);
  });

  it('round-trips bold text nested inside a link label', () => {
    const source = '[**Immich**](https://immich.app) is great.';
    const once = roundTrip(source);
    expect(once).toBe(source);
  });

  it('is idempotent on a full multi-block entry', () => {
    const source = [
      '---',
      'title: "A trip"',
      '---',
      '',
      '# Heading',
      '',
      'Read more at [Immich](https://immich.app), it is **great** and *fun*.',
      '',
      '> **Yes** he said -- Someone',
      '',
      '![abc123:wide](A **bold** caption)',
      '',
      "![abc123, def456](Anna's photos)",
    ].join('\n');

    const once = roundTrip(source);
    const twice = roundTrip(once);
    expect(twice).toBe(once);
    expect(once).toContain('[Immich](https://immich.app)');
    expect(once).toContain("Anna's photos");
  });
});
