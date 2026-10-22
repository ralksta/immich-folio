// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AssetPicker from '../AssetPicker';
import { SESSION_EXPIRED_EVENT } from '../sessionExpiry';

/**
 * #821: the picker's loads now go through adminGet, so a failure carries the
 * server's reason and a 401 signs the admin out like everywhere else.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function stub(handler: (url: string) => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => handler(String(input))),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AssetPicker load errors', () => {
  it('show the server’s reason when the photos fail', async () => {
    stub(() => json({ error: 'Immich is unreachable' }, 502));
    render(<AssetPicker onSelect={() => {}} onClose={() => {}} />);
    expect(
      await screen.findByText('Could not load (HTTP 502): Immich is unreachable.'),
    ).toBeTruthy();
  });

  it('report a failed album list and keep the album picker closed', async () => {
    stub((url) =>
      url === '/api/admin/albums'
        ? json({ error: 'disk full' }, 500)
        : json({ assets: [], nextPage: null }),
    );
    render(<AssetPicker onSelect={() => {}} onClose={() => {}} enableAlbumSelection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Albums' }));
    expect(await screen.findByText('Could not load (HTTP 500): disk full.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Select Album' })).toBeNull();
  });

  it('raise the session-expired event on a 401', async () => {
    stub(() => json({}, 401));
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    render(<AssetPicker onSelect={() => {}} onClose={() => {}} />);
    expect(await screen.findByText(/session expired/i)).toBeTruthy();
    expect(expired).toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });
});
