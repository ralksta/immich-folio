// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import AdminOverview from '../components/AdminOverview';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Every admin endpoint answers 404 except gallery.yaml, which holds `gallery`. */
function stubGallery(gallery: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/api/admin/gallery'
        ? new Response(JSON.stringify({ gallery, version: 'v' }), { status: 200 })
        : new Response(JSON.stringify({ error: 'nope' }), { status: 404 }),
    ),
  );
}

/** The "Pages" tile: its number and the note under it, once loaded. */
async function pagesTile() {
  const label = await screen.findByText('Pages');
  const tile = label.closest('a')!;
  const value = () => tile.querySelector('.overview-stat-value')!.textContent;
  await waitFor(() => expect(value()).not.toBe('–'));
  return { value: value(), note: tile.querySelector('.overview-stat-note')!.textContent };
}

describe('AdminOverview — Pages tile', () => {
  it('counts subpages written in the older map form of gallery.yaml', async () => {
    // `subpages:` as a map of name → albums (or name → object) is still a
    // valid gallery.yaml — getConfig() and the page builder both read it.
    // The overview called .filter() on it, and the first admin screen crashed.
    stubGallery({
      subpages: {
        Weddings: ['11111111-1111-4111-8111-111111111111'],
        Travel: { albums: ['22222222-2222-4222-8222-222222222222'], enabled: false },
      },
    });
    render(<AdminOverview />);
    expect(await pagesTile()).toEqual({ value: '1', note: '1 switched off' });
  });

  it('leaves content-page menu entries out of the list form', async () => {
    stubGallery({
      subpages: [
        { name: 'Weddings', albums: ['11111111-1111-4111-8111-111111111111'] },
        { page: 'pricing' },
        { name: 'Old', albums: [], enabled: false },
      ],
    });
    render(<AdminOverview />);
    expect(await pagesTile()).toEqual({ value: '1', note: '1 switched off' });
  });
});
