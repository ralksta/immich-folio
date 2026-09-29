// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';
import { EssayView } from '../EssayView';
import { parseEssayMarkdown } from '@/lib/essay';
import { encodeEmail } from '@/lib/emailObfuscation';

/**
 * The anonymous proofing selection lives under `folio_fav_<albumName>`, so it
 * can hold tokens this grid does not show: a photo since removed from the
 * album, or a favourite from another album whose name slugs the same way.
 * Every count the visitor sees must be the photos of *this* album that are
 * selected — the modal's download button already counted that way, while the
 * bar, the title and the email subject counted the whole stored set.
 */

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));
vi.mock('@/components/Lightbox', () => ({ Lightbox: () => null }));
vi.mock('@/components/LeafletMap', () => ({
  LeafletMap: () => null,
  escapeHtml: (s: string) => s,
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('proofing counts in the album grid', () => {
  it('counts only this album’s photos, not stale or foreign favourites', async () => {
    // One photo of this album, one removed photo, one from a same-named album.
    store.set('folio_fav_wedding', JSON.stringify(['a2', 'gone', 'other-album']));
    render(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);

    expect(await screen.findByText('❤️ 1 Selected')).toBeTruthy();

    fireEvent.click(screen.getByText('Share & Export'));
    expect(screen.getByText('❤️ Selection (1)')).toBeTruthy();
    expect(screen.getByText(/You have selected 1 photo\./)).toBeTruthy();
  });

  it('shows no selection bar when only foreign favourites are stored', () => {
    store.set('folio_fav_wedding', JSON.stringify(['gone', 'other-album']));
    render(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);
    // `render` flushes the hydration effect, so the stored set is loaded here.
    expect(screen.queryByText(/Selected/)).toBeNull();
    expect(screen.queryByText('Share & Export')).toBeNull();
  });

  it('keeps "Show All" reachable after the last favourite is removed in the filter', async () => {
    store.set('folio_fav_wedding', JSON.stringify(['a1']));
    render(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);
    fireEvent.click(await screen.findByText('❤️ 1 Selected'));
    // Filtered to the one favourite; un-heart it and the grid is empty.
    fireEvent.click(screen.getByLabelText('Remove favorite'));
    expect(screen.queryByLabelText('Add favorite')).toBeNull();
    // The empty state offers "Show All" too; this is about the bar's own.
    const bar = document.querySelector<HTMLElement>('.proofing-sticky-bar')!;
    fireEvent.click(within(bar).getByText('Show All'));
    expect(screen.getAllByLabelText('Add favorite')).toHaveLength(3);
  });

  it('puts the album count into the email subject', async () => {
    store.set('folio_fav_wedding', JSON.stringify(['a1', 'gone']));
    render(
      <PhotoGrid
        assets={ASSETS}
        proofing
        albumName="Wedding"
        allowMailto
        encodedMailto={encodeEmail('hello@example.com')}
      />,
    );
    fireEvent.click(await screen.findByText('Share & Export'));
    const location = { href: 'http://localhost/wedding' };
    vi.stubGlobal('location', location);
    fireEvent.click(screen.getByText('✉️ Send Email to Photographer'));
    expect(decodeURIComponent(location.href)).toMatch(/Photo Selection \(1 items?\)/);
  });
});

describe('proofing counts in an essay', () => {
  it('counts only the essay’s photos', async () => {
    store.set('folio_fav_story', JSON.stringify(['a3', 'gone']));
    const essay = parseEssayMarkdown('---\ntitle: Story\n---\n\n![a1, a3](caption)\n');
    render(<EssayView essay={essay} assets={ASSETS} title="Story" proofing />);
    expect(await screen.findByText('❤️ 1 Selected')).toBeTruthy();
  });
});
