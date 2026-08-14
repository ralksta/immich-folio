import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  decodeHtmlEntities,
  renderInlineMarkdown,
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from '../journal';

/**
 * The previous sanitizer was a denylist: strip `<script>`, strip `on*="..."`,
 * strip the literal `javascript:`. Every case below passed straight through it
 * and into `dangerouslySetInnerHTML`. They are kept as regression tests rather
 * than as a list of things to filter — the implementation escapes instead, so
 * none of them is special.
 */
describe('sanitizeHtml', () => {
  const bypasses: [string, string][] = [
    ['unquoted event handler', '<img src=x onerror=alert(1)>'],
    ['single-quoted event handler', "<img src=x onerror='alert(1)'>"],
    ['non-script tag', '<svg onload=alert(1)>'],
    ['recombining scheme', 'javasjavascript:cript:alert(1)'],
    ['uppercase tag', '<IMG SRC=x ONERROR=alert(1)>'],
  ];

  it.each(bypasses)('neutralises %s', (_name, input) => {
    const out = sanitizeHtml(input);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('leaves plain text readable', () => {
    expect(sanitizeHtml('5 > 3 && 2 < 4')).toBe('5 &gt; 3 &amp;&amp; 2 &lt; 4');
  });
});

describe('renderInlineMarkdown', () => {
  it('still renders bold, italic and safe links', () => {
    const html = renderInlineMarkdown('**bold** and *italic* and [link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>',
    );
  });

  it.each([
    ['relative', '/albums/iceland'],
    ['anchor', '#section'],
    ['mailto', 'mailto:hi@example.com'],
  ])('allows %s links', (_name, url) => {
    expect(renderInlineMarkdown(`[x](${url})`)).toContain(`href="${url}"`);
  });

  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['recombining javascript', 'javasjavascript:cript:alert(1)'],
    ['whitespace-obfuscated javascript', 'java\tscript:alert(1)'],
    ['data url', 'data:text/html,<script>alert(1)</script>'],
  ])('renders %s links as plain text instead of an anchor', (_name, url) => {
    const html = renderInlineMarkdown(`[click me](${url})`);
    // The label survives, the URL does not become a link. A stray `)` may be
    // left over because the link pattern stops at the first closing paren —
    // pre-existing behaviour, and harmless as text.
    expect(html).toContain('click me');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href');
  });

  it('does not let a url break out of the href attribute', () => {
    const html = renderInlineMarkdown('[x](" onmouseover=alert(1) x=")');
    expect(html).not.toContain('onmouseover=alert(1)');
  });

  it('does not let a label inject markup', () => {
    const html = renderInlineMarkdown('[<img src=x onerror=alert(1)>](https://example.com)');
    expect(html).not.toContain('<img');
  });
});

describe('markdown round trip', () => {
  it('does not accumulate entities when parsing and serializing repeatedly', () => {
    const source = '---\ntitle: "T"\n---\n\nAngle < bracket & ampersand "quoted"\n';

    const once = serializeJournalMarkdown(parseJournalMarkdown(source));
    const twice = serializeJournalMarkdown(parseJournalMarkdown(once));

    expect(once).toContain('Angle < bracket & ampersand "quoted"');
    expect(twice).toBe(once);
  });

  it('decodes exactly what sanitizeHtml encodes', () => {
    const raw = `<a href="x">5 & 6 don't</a>`;
    expect(decodeHtmlEntities(sanitizeHtml(raw))).toBe(raw);
  });
});
