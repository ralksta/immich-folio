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

function renderJournalEditor() {
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
              assetCount: 3,
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
              id: 'second-photo',
              originalFileName: 'second.jpg',
              fileCreatedAt: '2026-05-11T12:00:00.000Z',
              isFavorite: false,
            },
            {
              id: 'third-photo',
              originalFileName: 'third.jpg',
              fileCreatedAt: '2026-05-12T12:00:00.000Z',
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
  return fetchMock;
}

async function selectSharedAlbum() {
  fireEvent.click(await screen.findByRole('button', { name: 'Albums' }));
  expect(await screen.findByRole('button', { name: /^Private trip/ })).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: /^Shared trip/ }));
}

describe('JournalEditor shared album photo selection', () => {
  it('adds individually selected album photos as photo blocks with + Photos', async () => {
    const fetchMock = renderJournalEditor();

    fireEvent.click(await screen.findByRole('button', { name: /^\+ Photos$/ }));
    await selectSharedAlbum();
    expect(screen.queryByRole('button', { name: /^Private trip/ })).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: /^selected\.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: /^second\.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 photos' }));

    const photoBlocks = await screen.findAllByRole('button', { name: 'Change photo' });
    expect(photoBlocks).toHaveLength(2);
    expect(photoBlocks.map((button) => button.querySelector('img')?.getAttribute('src'))).toEqual([
      '/api/admin/thumbnail/selected-photo',
      '/api/admin/thumbnail/second-photo',
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/albums/shared-album/assets');
    expect(screen.queryByRole('dialog', { name: 'Add Photos (one block each)' })).toBeNull();
  });

  it('adds one selected shared-album photo as a photo block with + Photo', async () => {
    renderJournalEditor();

    fireEvent.click(await screen.findByRole('button', { name: /^\+ Photo$/ }));
    await selectSharedAlbum();
    fireEvent.click(await screen.findByRole('button', { name: /^selected\.jpg/ }));

    const photoBlock = await screen.findByRole('button', { name: 'Change photo' });
    expect(photoBlock.querySelector('img')?.getAttribute('src')).toBe(
      '/api/admin/thumbnail/selected-photo',
    );
  });

  it('Escape closes only the album picker when it is stacked over the asset picker', async () => {
    renderJournalEditor();

    fireEvent.click(await screen.findByRole('button', { name: /^\+ Photo$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Albums' }));
    expect(await screen.findByRole('dialog', { name: 'Select Album' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Select Album' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Select Photo for the Entry' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Select Photo for the Entry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pick a photo' })).toBeNull();
  });

  it('requires exactly two selected shared-album photos for + 2-Photo Pair', async () => {
    renderJournalEditor();

    fireEvent.click(await screen.findByRole('button', { name: /^\+ 2-Photo Pair$/ }));
    await selectSharedAlbum();
    fireEvent.click(await screen.findByRole('button', { name: /^selected\.jpg/ }));
    expect((screen.getByRole('button', { name: 'Add photo' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: /^second\.jpg/ }));

    expect(
      (screen.getByRole('button', { name: /^third\.jpg/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 photos' }));

    const firstSlot = await screen.findByRole('button', { name: 'Change photo 1 of the pair' });
    const secondSlot = screen.getByRole('button', { name: 'Change photo 2 of the pair' });
    expect(firstSlot.querySelector('img')?.getAttribute('src')).toBe(
      '/api/admin/thumbnail/selected-photo',
    );
    expect(secondSlot.querySelector('img')?.getAttribute('src')).toBe(
      '/api/admin/thumbnail/second-photo',
    );
  });

  it('adds selected shared-album photos to a grid with + Photo Grid', async () => {
    renderJournalEditor();

    fireEvent.click(await screen.findByRole('button', { name: /^\+ Photo Grid$/ }));
    await selectSharedAlbum();
    fireEvent.click(await screen.findByRole('button', { name: /^selected\.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: /^second\.jpg/ }));
    expect(
      (screen.getByRole('button', { name: 'Add 2 photos' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^third\.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 photos' }));

    const editor = document.querySelector('.journal-editor-pane-left');
    expect(
      Array.from(editor?.querySelectorAll('.journal-grid-tile img') ?? []).map((image) =>
        image.getAttribute('src'),
      ),
    ).toEqual([
      '/api/admin/thumbnail/selected-photo',
      '/api/admin/thumbnail/second-photo',
      '/api/admin/thumbnail/third-photo',
    ]);
  });
});
