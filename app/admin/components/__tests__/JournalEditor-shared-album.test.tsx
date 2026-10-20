// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { JournalEditor } from '../journal/JournalEditor';
import { ConfirmProvider } from '../ConfirmDialog';
import { NotificationProvider } from '../Notifications';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe('JournalEditor shared album photo selection', () => {
  it('adds individually selected album photos as photo blocks with + Photos', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === '/api/admin/journal/story') {
        return new Response(
          JSON.stringify({
            entry: {
              slug: 'story',
              rawMarkdown: '---\ntitle: "Story"\ndraft: true\n---\n\nA story.\n',
            },
            version: 'v1',
          }),
          { status: 200 },
        );
      }
      if (url === '/api/admin/albums') {
        return new Response(
          JSON.stringify({
            albums: [
              {
                id: 'shared-album',
                albumName: 'Shared trip',
                description: '',
                thumbnailAssetId: null,
                assetCount: 2,
                isConfigured: false,
                shared: true,
              },
              {
                id: 'private-album',
                albumName: 'Private trip',
                description: '',
                thumbnailAssetId: null,
                assetCount: 1,
                isConfigured: false,
                shared: false,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url === '/api/admin/albums/shared-album/assets') {
        return new Response(
          JSON.stringify({
            assets: [
              {
                id: 'selected-photo',
                originalFileName: 'selected.jpg',
                fileCreatedAt: '2026-05-10T12:00:00.000Z',
                isFavorite: false,
              },
              {
                id: 'not-selected-photo',
                originalFileName: 'not-selected.jpg',
                fileCreatedAt: '2026-05-11T12:00:00.000Z',
                isFavorite: false,
              },
            ],
            nextPage: null,
          }),
          { status: 200 },
        );
      }
      if (url.startsWith('/api/admin/assets?')) {
        return new Response(JSON.stringify({ assets: [], nextPage: null }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    });

    render(
      <NotificationProvider>
        <ConfirmProvider>
          <JournalEditor slug="story" onBack={() => {}} />
        </ConfirmProvider>
      </NotificationProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /\+ Photos/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Albums' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Shared trip/ }));
    expect(screen.queryByRole('button', { name: /^Private trip/ })).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: /^selected\.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: /^not-selected\.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 photos' }));

    const photoBlocks = await screen.findAllByRole('button', { name: 'Change photo' });
    expect(photoBlocks).toHaveLength(2);
    expect(photoBlocks.map((button) => button.querySelector('img')?.getAttribute('src'))).toEqual([
      '/api/admin/thumbnail/selected-photo',
      '/api/admin/thumbnail/not-selected-photo',
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/albums/shared-album/assets');
    expect(screen.queryByRole('dialog', { name: 'Add Photos (one block each)' })).toBeNull();
  });
});
