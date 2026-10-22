// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ProofingView from '../ProofingView';

/**
 * #821: the proofing screen loaded through its own wrapper. A failed list
 * showed the message with no retry, and a failed selection left the card's
 * spinner turning for good.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const session = {
  id: 's1',
  clientName: 'Anna',
  albumId: 'a1',
  albumName: 'Wedding',
  link: '/proof/s1',
  createdAt: '2026-10-01T10:00:00.000Z',
  expiresOn: null,
  download: 'none',
  downloadLimit: null,
  downloadsUsed: 0,
  selected: 2,
  submittedAt: null,
  total: 10,
};

function stub(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const handler = routes[String(input)];
    if (!handler) throw new Error(`Unexpected fetch: ${String(input)}`);
    return handler();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the proofing screen', () => {
  it('offers a retry when the list fails, and shows the links once it loads', async () => {
    let list = () => json({ error: 'disk full' }, 500);
    stub({
      '/api/admin/albums': () => json({ albums: [] }),
      '/api/admin/proofing': () => list(),
    });
    render(<ProofingView />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('HTTP 500');
    expect(alert.textContent).toContain('disk full');

    list = () => json({ sessions: [session], webhookConfigured: true });
    fireEvent.click(within(alert).getByRole('button', { name: /Retry/ }));
    expect(await screen.findByText('Anna')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says when the album list fails instead of offering an empty choice', async () => {
    stub({
      '/api/admin/albums': () => json({ error: 'Immich is unreachable' }, 502),
      '/api/admin/proofing': () => json({ sessions: [], webhookConfigured: true }),
    });
    render(<ProofingView />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Immich is unreachable');
  });
});
