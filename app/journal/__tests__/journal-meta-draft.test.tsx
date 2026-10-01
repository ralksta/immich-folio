import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

/**
 * P-17: /journal shared as the site's home page (no openGraph of its own), and
 * its meta description was a sentence the page never showed.
 * P-21: a draft entry, which only an admin can open, looked published — the
 * index marks drafts, the entry page did not.
 */

const readJournalEntry = vi.fn();
let admin = false;

vi.mock('@/lib/admin/journal-service', () => ({
  readJournalEntry: (slug: string) => readJournalEntry(slug),
  listJournalEntries: async () => [],
}));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => admin }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('@/lib/config', () => ({
  getConfig: () => ({ authSecret: 'test-secret', watermark: undefined }),
  getConfigOrNull: () => ({ lang: 'en' }),
}));
vi.mock('@/app/[...path]/essayPayload', () => ({
  buildEssayPayload: async () => ({
    essay: { frontmatter: {}, blocks: [] },
    images: [],
    coverToken: undefined,
  }),
}));
vi.mock('@/app/[...path]/EssayView', () => ({ EssayView: () => null }));
vi.mock('@/components/JournalNav', () => ({ JournalNav: () => null }));
vi.mock('@/components/BackLink', () => ({ BackLink: () => null }));
vi.mock('@/components/PasswordGate', () => ({ default: function PasswordGate() {} }));

const { default: JournalDetailPage } = await import('../[slug]/page');
const { generateMetadata: indexMetadata } = await import('../page');
const { getServerDictionary } = await import('@/lib/i18n/server');

/** Every string rendered anywhere in an element tree. */
function texts(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  const el = node as ReactElement<{ children?: ReactNode }>;
  return texts(el.props?.children);
}

describe('/journal metadata', () => {
  it('shares as the journal, with the subtitle the page shows', () => {
    const t = getServerDictionary();
    const m = indexMetadata();
    expect(m.title).toBe(t.journal.title);
    expect(m.description).toBe(t.journal.subtitle);
    expect(m.openGraph?.title).toBe(t.journal.title);
    expect(m.openGraph?.description).toBe(t.journal.subtitle);
    const images = m.openGraph?.images as string[];
    expect(images).toHaveLength(1);
    expect(new URL(images[0], 'https://x.test').searchParams.get('title')).toBe(t.journal.title);
  });
});

describe('journal entry draft badge', () => {
  beforeEach(() => {
    admin = true;
    readJournalEntry.mockReset();
  });

  const render = async () =>
    texts((await JournalDetailPage({ params: Promise.resolve({ slug: 'trip' }) })) as ReactElement);

  it('marks a draft for the admin previewing it', async () => {
    readJournalEntry.mockResolvedValue({
      slug: 'trip',
      parsed: { frontmatter: { title: 'Trip', draft: true }, blocks: [] },
    });
    expect(await render()).toContain(getServerDictionary().journal.draft);
  });

  it('does not mark a published entry', async () => {
    readJournalEntry.mockResolvedValue({
      slug: 'trip',
      parsed: { frontmatter: { title: 'Trip' }, blocks: [] },
    });
    expect(await render()).not.toContain(getServerDictionary().journal.draft);
  });
});
