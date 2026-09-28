import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * One render of a journal page used to read the journal directory twice —
 * the header nav in the root layout listed every entry, then the page listed
 * them again — and an entry's file twice, once for `generateMetadata()` and
 * once for the page body. The home page loaded the whole site nav twice, for
 * the header and for the hero. Those reads now go through React's per-request
 * `cache()`.
 *
 * Outside a server render `cache()` does not memoise, so the test stands in a
 * memo that lasts until `newRequest()`: what it checks is that every read goes
 * through `cache()`, and that a new request reads the files again.
 */

const memo = vi.hoisted(() => ({ current: new Map<unknown, Map<string, unknown>>() }));
const newRequest = () => memo.current.clear();

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return {
    ...react,
    cache:
      <A extends unknown[], R>(fn: (...args: A) => R) =>
      (...args: A): R => {
        let results = memo.current.get(fn);
        if (!results) memo.current.set(fn, (results = new Map()));
        const key = JSON.stringify(args);
        if (!results.has(key)) results.set(key, fn(...args));
        return results.get(key) as R;
      },
  };
});

const calls = vi.hoisted(() => ({ list: 0, read: 0, pages: 0, subpages: 0 }));

const ENTRIES = ['gamma', 'beta', 'alpha'].map((slug) => ({
  slug,
  filename: `${slug}.md`,
  frontmatter: { title: slug.toUpperCase(), date: '2026-01-01' },
  excerpt: '',
  wordCount: 1,
  readingTimeMinutes: 1,
}));

vi.mock('@/lib/admin/journal-service', () => ({
  listJournalEntries: async () => {
    calls.list++;
    return ENTRIES;
  },
  readJournalEntry: async (slug: string) => {
    calls.read++;
    return {
      slug,
      rawMarkdown: '',
      parsed: { frontmatter: { title: slug.toUpperCase() }, blocks: [] },
    };
  },
}));
vi.mock('@/lib/admin/pages-service', () => ({
  listPages: async () => {
    calls.pages++;
    return [];
  },
}));
vi.mock('@/lib/immich', () => ({
  immich: {
    getSubpages: async () => {
      calls.subpages++;
      return [];
    },
    getStandaloneAlbums: async () => [],
    getAssetInfo: async () => null,
  },
}));
vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    authSecret: 'x'.repeat(32),
    nav: [],
    aboutEnabled: false,
    map: false,
    watermark: undefined,
  }),
}));
vi.mock('@/lib/i18n/server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getServerDictionary: () => getDictionary('en') };
});
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => false }));
vi.mock('@/app/[...path]/essayPayload', () => ({
  buildEssayPayload: async () => ({ essay: { frontmatter: {}, blocks: [] }, images: [] }),
}));
// Client components the page only hands props to.
vi.mock('@/app/[...path]/EssayView', () => ({ EssayView: () => null }));
vi.mock('@/components/JournalNav', () => ({ JournalNav: () => null }));
vi.mock('@/components/PasswordGate', () => ({ default: () => null }));
vi.mock('@/components/BackLink', () => ({ BackLink: () => null }));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/image', () => ({ default: () => null }));

import JournalEntryPage, { generateMetadata } from '../[slug]/page';
import JournalIndexPage from '../page';
import { loadSiteNav } from '@/lib/siteNav.server';

const params = { params: Promise.resolve({ slug: 'beta' }) };

beforeEach(() => {
  newRequest();
  Object.assign(calls, { list: 0, read: 0, pages: 0, subpages: 0 });
});

describe('journal reads per request', () => {
  it('an entry page lists the journal once and reads its file once', async () => {
    // The order a render takes: layout nav, metadata, page body.
    await Promise.all([loadSiteNav(), generateMetadata(params), JournalEntryPage(params)]);
    expect(calls).toMatchObject({ list: 1, read: 1 });
  });

  it('the journal index lists the journal once', async () => {
    await Promise.all([loadSiteNav(), JournalIndexPage()]);
    expect(calls.list).toBe(1);
  });

  it('the home page loads the site nav once for the header and the hero', async () => {
    await Promise.all([loadSiteNav(), loadSiteNav()]);
    expect(calls).toMatchObject({ list: 1, pages: 1, subpages: 1 });
  });

  it('reads the files again on the next request', async () => {
    await Promise.all([loadSiteNav(), generateMetadata(params), JournalEntryPage(params)]);
    newRequest();
    await Promise.all([loadSiteNav(), generateMetadata(params), JournalEntryPage(params)]);
    expect(calls).toMatchObject({ list: 2, read: 2 });
  });
});
