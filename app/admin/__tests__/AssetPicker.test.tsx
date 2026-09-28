// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import AssetPicker from '../components/AssetPicker';

/**
 * A fetch whose answers the test hands out by hand, in any order — the
 * situation of a slow request still running when the operator moves on.
 */
function deferredFetch() {
  const pending: Array<{ url: string; resolve: (body: unknown) => void }> = [];
  const fetchMock = vi.fn(
    (url: string) =>
      new Promise<Response>((resolve) => {
        pending.push({
          url,
          resolve: (body) =>
            resolve({ ok: true, status: 200, json: async () => body } as unknown as Response),
        });
      }),
  );
  /** Answer the first open request whose URL contains `match`. */
  const answer = async (match: string, body: unknown) => {
    const i = pending.findIndex((p) => p.url.includes(match));
    if (i === -1) throw new Error(`no pending request for ${match}`);
    const [req] = pending.splice(i, 1);
    await act(async () => req.resolve(body));
  };
  return { fetchMock, answer };
}

const asset = (id: string, name: string) => ({
  id,
  originalFileName: name,
  fileCreatedAt: '2024-05-17T10:00:00.000Z',
  isFavorite: false,
});

let net: ReturnType<typeof deferredFetch>;

beforeEach(() => {
  net = deferredFetch();
  vi.stubGlobal('fetch', net.fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AssetPicker', () => {
  it('shows the tab it is on when an older request answers last', async () => {
    render(<AssetPicker onSelect={() => {}} onClose={() => {}} />);
    // Opens on Favorites; the operator switches to All Photos before it loads.
    fireEvent.click(screen.getByRole('button', { name: /All Photos/ }));

    await net.answer('favorites=false', { assets: [asset('a1', 'all.jpg')], nextPage: null });
    await net.answer('favorites=true', { assets: [asset('f1', 'fav.jpg')], nextPage: null });

    expect(screen.getByRole('button', { name: /all\.jpg/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /fav\.jpg/ })).toBeNull();
  });

  it('keeps the spinner until the current request answers', async () => {
    render(<AssetPicker onSelect={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /All Photos/ }));

    // The stale Favorites answer must not end the All Photos loading state.
    await net.answer('favorites=true', { assets: [asset('f1', 'fav.jpg')], nextPage: null });
    expect(screen.queryByRole('button', { name: /fav\.jpg/ })).toBeNull();
    expect(screen.queryByText(/No favorite photos found/)).toBeNull();

    await net.answer('favorites=false', { assets: [asset('a1', 'all.jpg')], nextPage: null });
    expect(screen.getByRole('button', { name: /all\.jpg/ })).toBeTruthy();
  });
});
