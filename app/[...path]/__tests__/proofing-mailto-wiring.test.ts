import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The page renders albums and essays from several branches — subpage album,
 * essay, single-album subpage, standalone album — and each one passes the
 * proofing props by hand. The dialog hides its email button without a
 * recipient (#736), so a branch that forwards `allowMailto` but forgets
 * `encodedMailto` silently loses the button on that kind of page. #746 missed
 * two of the four; this keeps the next branch from doing the same.
 */

const source = fs.readFileSync(path.join(__dirname, '..', 'page.tsx'), 'utf8');

/** Every `<AlbumDetailView … />` and `<EssayView … />` element in the page. */
const elements = source.match(/<(AlbumDetailView|EssayView)\b[\s\S]*?\/>/g) ?? [];

describe('proofing email wiring in the catch-all page', () => {
  it('finds the album and essay views', () => {
    expect(elements.length).toBeGreaterThanOrEqual(4);
  });

  it('passes the recipient wherever it passes the email switch', () => {
    const missing = elements
      .filter((el) => el.includes('allowMailto='))
      .filter((el) => !el.includes('encodedMailto='))
      .map((el) => el.split('\n').slice(0, 3).join(' ').trim());
    expect(missing).toEqual([]);
  });
});
