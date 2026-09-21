import { describe, it, expect } from 'vitest';
import { isActivePath } from '@/components/NavLink';

/**
 * The header has styled `.active` since it was written and never applied it.
 * These pin the matching rules, in particular the two that are easy to get
 * wrong: Home must not light up everywhere, and one subpage slug must not
 * match another that merely starts the same way.
 */
describe('isActivePath', () => {
  it('marks Home only on the home page', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/reisen', '/')).toBe(false);
    expect(isActivePath('/journal/island', '/')).toBe(false);
  });

  it('marks a subpage on its own page', () => {
    expect(isActivePath('/reisen', '/reisen')).toBe(true);
  });

  it('marks a subpage while inside one of its albums', () => {
    // An album lives at /<subpage>/<album>, and the visitor is still "in" that
    // section of the site.
    expect(isActivePath('/reisen/island', '/reisen')).toBe(true);
  });

  it('does not let one slug match another that starts the same way', () => {
    expect(isActivePath('/reisender', '/reisen')).toBe(false);
    expect(isActivePath('/reisen-2026', '/reisen')).toBe(false);
  });

  it('marks Journal on an entry as well as the index', () => {
    expect(isActivePath('/journal', '/journal')).toBe(true);
    expect(isActivePath('/journal/eine-reise', '/journal')).toBe(true);
  });

  it('marks nothing when the path is unknown', () => {
    expect(isActivePath(null, '/about')).toBe(false);
  });

  it('leaves unrelated links alone', () => {
    expect(isActivePath('/about', '/map')).toBe(false);
    expect(isActivePath('/map', '/about')).toBe(false);
  });

  it('marks exactly one link for a typical header', () => {
    const header = ['/', '/reisen', '/journal', '/about', '/map'];
    const activeOn = (pathname: string) => header.filter((h) => isActivePath(pathname, h));

    expect(activeOn('/')).toEqual(['/']);
    expect(activeOn('/reisen')).toEqual(['/reisen']);
    expect(activeOn('/reisen/island')).toEqual(['/reisen']);
    expect(activeOn('/journal/eine-reise')).toEqual(['/journal']);
    expect(activeOn('/impressum')).toEqual([]);
  });
});
