import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

/**
 * A password-protected journal entry is hidden by name everywhere a visitor
 * can look before unlocking it: the index, the prev/next links and the page
 * metadata (GHSA-fvgv-97g3-wjr7). The gate itself printed the real title,
 * which undid all of that for anyone who guessed or was sent the URL.
 */

const readJournalEntry = vi.fn();

vi.mock('@/lib/admin/journal-service', () => ({
  readJournalEntry: (slug: string) => readJournalEntry(slug),
  listJournalEntries: async () => [],
}));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: async () => false }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('@/lib/config', () => ({
  getConfig: () => ({ authSecret: 'test-secret' }),
  getConfigOrNull: () => ({ lang: 'en' }),
}));
vi.mock('@/app/[...path]/essayPayload', () => ({ buildEssayPayload: vi.fn() }));
vi.mock('@/app/[...path]/EssayView', () => ({ EssayView: () => null }));
vi.mock('@/components/JournalNav', () => ({ JournalNav: () => null }));
vi.mock('@/components/BackLink', () => ({ BackLink: () => null }));
vi.mock('@/components/PasswordGate', () => ({ default: function PasswordGate() {} }));

const { default: JournalDetailPage } = await import('../[slug]/page');
const { default: PasswordGate } = await import('@/components/PasswordGate');
const { getServerDictionary } = await import('@/lib/i18n/server');

describe('journal entry password gate', () => {
  beforeEach(() => {
    readJournalEntry.mockReset();
    readJournalEntry.mockResolvedValue({
      slug: 'secret-trip',
      parsed: {
        frontmatter: { title: 'Weekend with Alex in Lisbon', password: 'hunter2' },
        blocks: [],
      },
    });
  });

  it('shows the generic journal title, not the entry title', async () => {
    const el = (await JournalDetailPage({
      params: Promise.resolve({ slug: 'secret-trip' }),
    })) as ReactElement<{ title: string; slug: string; type: string }>;

    expect(el.type).toBe(PasswordGate);
    expect(el.props.type).toBe('journal');
    expect(el.props.slug).toBe('secret-trip');
    expect(el.props.title).toBe(getServerDictionary().journal.title);
    expect(el.props.title).not.toContain('Lisbon');
  });
});
