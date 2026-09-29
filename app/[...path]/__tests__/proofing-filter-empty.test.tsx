// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';

/**
 * With "show selected" on, un-hearting the last favourite emptied the grid and
 * left nothing between the album header and the footer — no word on why, and
 * the only way back a small pill in the corner.
 */

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));
vi.mock('@/components/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const photo = (id: string): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio: 1.5,
});

const ASSETS = [photo('a1'), photo('a2'), photo('a3')];

let store: Map<string, string>;

beforeEach(() => {
  // Node 26 defines its own global localStorage (undefined without
  // --localstorage-file), which shadows jsdom's; give the test a working one.
  store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  window.history.replaceState(null, '', '/wedding');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('favourites filter with nothing left', () => {
  it('says nothing is selected and offers the way back to all photos', async () => {
    store.set('folio_fav_wedding', JSON.stringify(['a2']));
    render(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);

    fireEvent.click(await screen.findByText('❤️ 1 Selected'));
    expect(screen.getAllByLabelText(/^View photo/)).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('Remove favorite'));

    const empty = screen.getByRole('status');
    expect(within(empty).getByText('No photos selected.')).toBeTruthy();
    expect(screen.queryAllByLabelText(/^View photo/)).toHaveLength(0);

    fireEvent.click(within(empty).getByRole('button', { name: 'Show All' }));
    expect(screen.getAllByLabelText(/^View photo/)).toHaveLength(3);
    expect(screen.queryByText('No photos selected.')).toBeNull();
  });

  it('shows no empty state while the filter still has photos', async () => {
    store.set('folio_fav_wedding', JSON.stringify(['a1', 'a2']));
    render(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);
    fireEvent.click(await screen.findByText('❤️ 2 Selected'));
    expect(screen.getAllByLabelText(/^View photo/)).toHaveLength(2);
    expect(screen.queryByText('No photos selected.')).toBeNull();
  });
});
