// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';

/**
 * With "show selected" on, the lightbox walks the favourites only. Un-hearting
 * the photo on screen takes it out of that list while the viewer is open: on
 * the last favourite the index pointed past the end and the viewer crashed the
 * page (`current` undefined), and on the only one the list was empty.
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

async function openFilteredLightboxOn(n: number) {
  render(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);
  fireEvent.click(await screen.findByText(/❤️ \d Selected/));
  fireEvent.click(screen.getByLabelText(`View photo ${n}`));
  return screen.getByRole('dialog');
}

const shownPhoto = (dialog: HTMLElement) =>
  dialog.querySelector('img')?.getAttribute('src')?.split('?')[0];

describe('un-hearting inside the filtered lightbox', () => {
  it('moves to the previous favourite when the last one is removed', async () => {
    store.set('folio_fav_wedding', JSON.stringify(['a1', 'a3']));
    const dialog = await openFilteredLightboxOn(2);
    expect(shownPhoto(dialog)).toBe('/p/a3');

    fireEvent.click(within(dialog).getByLabelText('Remove from favorites'));

    const after = screen.getByRole('dialog');
    expect(shownPhoto(after)).toBe('/p/a1');
    expect(within(after).getByText('1 / 1')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('photo')).toBe('a1');
  });

  it('closes the viewer when the only favourite is removed', async () => {
    store.set('folio_fav_wedding', JSON.stringify(['a2']));
    const dialog = await openFilteredLightboxOn(1);

    fireEvent.click(within(dialog).getByLabelText('Remove from favorites'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('photo')).toBeNull();
  });
});
