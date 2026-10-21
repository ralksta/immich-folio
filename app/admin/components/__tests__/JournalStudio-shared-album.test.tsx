// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { parseJournalMarkdown } from '@/lib/journal';
import { JournalStudio } from '../journal/JournalStudio';
import { ConfirmProvider } from '../ConfirmDialog';
import { NotificationProvider } from '../Notifications';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

describe('JournalStudio shared album creation', () => {
  it('adds only individually selected photos from a shared album', async () => {
    let createdContent: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/admin/journal' && init?.method === 'POST') {
          const body = JSON.parse(init.body as string) as { content?: string };
          createdContent = body.content;
          return new Response(JSON.stringify({ entry: { slug: 'shared-trip' } }), {
            status: 201,
          });
        }
        if (url === '/api/admin/journal') {
          return new Response(JSON.stringify({ entries: [] }), { status: 200 });
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
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <NotificationProvider>
        <ConfirmProvider>
          <JournalStudio />
        </ConfirmProvider>
      </NotificationProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /New Journal Entry/ }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Shared trip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Albums' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select album' }));
    expect(await screen.findByRole('button', { name: /Private trip/ })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Shared trip/ }));

    fireEvent.click(await screen.findByRole('button', { name: /^selected\.jpg/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create & Open Studio' }));

    await waitFor(() => expect(createdContent).toBeTruthy());
    const parsed = parseJournalMarkdown(createdContent!);
    expect(parsed.blocks).toEqual([
      { type: 'photo', assetId: 'selected-photo', caption: undefined, layout: 'contained' },
    ]);
    expect(createdContent).not.toContain('not-selected-photo');
    expect(push).toHaveBeenCalledWith('/admin/journal/shared-trip');
  });
});
