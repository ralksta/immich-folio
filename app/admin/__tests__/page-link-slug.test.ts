import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

// `?page=<slug>` in /admin/pages selects a page, and the page panel turns the
// slug into its "open live page" link. A slug such as `/evil.example` would
// make that link `//evil.example`, which leaves the site. Both ends guard it.
const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('page link from ?page=', () => {
  it('only selects a page for a valid slug', () => {
    const src = read('app/admin/components/PageBuilder.tsx');
    const fn = src.slice(src.indexOf('function openPageFromLink'));
    const body = fn.slice(0, fn.indexOf('\n  }\n'));
    expect(body).toMatch(/if \(!isValidSlug\(slug\)\) return;/);
    expect(body.indexOf('isValidSlug(slug)')).toBeLessThan(body.indexOf('setSelectedPage(slug)'));
  });

  it('encodes the slug in the live-page link', () => {
    const src = read('app/admin/components/page-builder/PagePanel.tsx');
    expect(src).toContain('href={`/${encodeURIComponent(slug)}`}');
    expect(src).not.toContain('href={`/${slug}`}');
  });
});
