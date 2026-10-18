// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AssetPicker from '../AssetPicker';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AssetPicker album-only mode', () => {
  it('returns only explicitly selected assets from the chosen album', async () => {
    const onSelectMany = vi.fn();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            assets: [
              {
                id: 'asset-from-album',
                originalFileName: 'selected.jpg',
                fileCreatedAt: '2026-05-10T12:00:00.000Z',
                isFavorite: false,
              },
            ],
            nextPage: null,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AssetPicker
        albumId="shared-album"
        albumOnly
        onSelectMany={onSelectMany}
        onClose={vi.fn()}
      />,
    );

    const photo = await screen.findByRole('button', { name: /selected\.jpg/ });
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/albums/shared-album/assets');
    expect(screen.getByRole('button', { name: 'This Album' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Favorites' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All Photos' })).toBeNull();
    expect(screen.queryByLabelText('Asset UUID')).toBeNull();

    fireEvent.click(photo);
    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
    expect(onSelectMany).toHaveBeenCalledWith(['asset-from-album']);
  });

  it('restores an existing explicit selection when the picker is reopened', async () => {
    const onSelectMany = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              assets: [
                {
                  id: 'asset-from-album',
                  originalFileName: 'selected.jpg',
                  fileCreatedAt: '2026-05-10T12:00:00.000Z',
                  isFavorite: false,
                },
              ],
              nextPage: null,
            }),
            { status: 200 },
          ),
      ),
    );

    render(
      <AssetPicker
        albumId="shared-album"
        albumOnly
        initialSelectedAssetIds={['asset-from-album']}
        onSelectMany={onSelectMany}
        onClose={vi.fn()}
      />,
    );

    const photo = await screen.findByRole('button', { name: /selected\.jpg/ });
    expect(photo.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
    expect(onSelectMany).toHaveBeenCalledWith(['asset-from-album']);
  });
});
