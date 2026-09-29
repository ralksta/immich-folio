import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * An expired proofing link rendered "This link has expired" under a tab that
 * said "Not found". The tab still names nobody, but now agrees with the page.
 */

vi.mock('@/lib/proofSessions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/proofSessions')>()),
  findSessionByToken: vi.fn(),
}));
vi.mock('@/lib/immich', () => ({ immich: {} }));
vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
  getConfigOrNull: vi.fn(() => null),
  hasExifPanelContent: vi.fn(),
}));

import { generateMetadata } from '../[token]/page';
import { findSessionByToken } from '@/lib/proofSessions';

const mockFind = findSessionByToken as unknown as ReturnType<typeof vi.fn>;
const params = Promise.resolve({ token: 'tok' });

beforeEach(() => mockFind.mockReset());

describe('proofing link tab title', () => {
  it('says an expired link has expired, and names nobody', async () => {
    mockFind.mockResolvedValue({ clientName: 'Anna', expiresOn: '2000-01-01', selection: [] });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe('This link has expired');
    expect(String(meta.title)).not.toContain('Anna');
  });

  it('greets the client on a live link', async () => {
    mockFind.mockResolvedValue({ clientName: 'Anna', expiresOn: null, selection: [] });
    expect((await generateMetadata({ params })).title).toBe('Selection for Anna');
  });

  it('says not found for a link that never existed', async () => {
    mockFind.mockResolvedValue(null);
    expect((await generateMetadata({ params })).title).toBe('Not found');
  });
});
