// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AlbumDetailView } from '../AlbumDetailView';
import type { ImmichAlbum } from '@/lib/immich';

/**
 * A single-album subpage renders the album itself. Its Display Title (shown by
 * Live Preview) has to be the page heading there too; without one the heading
 * stays the album's name.
 */

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));
vi.mock('../PhotoGrid', () => ({ PhotoGrid: () => null }));

afterEach(cleanup);

const album = { id: 'a1', albumName: 'Immich Album Name', assets: [] } as unknown as ImmichAlbum;
const base = { album, images: [], layout: 'masonry' as const, gridStyle: {} };

describe('AlbumDetailView heading', () => {
  it('uses the display title when one is given', () => {
    render(<AlbumDetailView {...base} title="My Display Title" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('My Display Title');
  });

  it('falls back to the album name without a display title', () => {
    render(<AlbumDetailView {...base} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Immich Album Name');
  });

  it('treats an empty display title as unset', () => {
    render(<AlbumDetailView {...base} title="" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Immich Album Name');
  });
});
