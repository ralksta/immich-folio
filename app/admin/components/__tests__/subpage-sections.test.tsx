// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import PageBuilder from '../PageBuilder';
import { NotificationProvider } from '../Notifications';
import { ConfirmProvider } from '../ConfirmDialog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/pages',
}));

const GALLERY_FIXTURE = {
  hero: [],
  albums: [],
  subpages: [
    {
      name: 'Travel',
      albums: ['alb-1', 'alb-2'],
    },
  ],
};

const IMMICH_ALBUMS = [
  { id: 'alb-1', albumName: 'Kyoto Streets', assetCount: 12, albumThumbnailAssetId: null },
  { id: 'alb-2', albumName: 'Osaka Night', assetCount: 8, albumThumbnailAssetId: null },
];

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/api/admin/gallery')) {
        return new Response(JSON.stringify({ gallery: GALLERY_FIXTURE, version: 'v1' }), {
          status: 200,
        });
      }
      if (url.includes('/api/admin/albums')) {
        return new Response(JSON.stringify({ albums: IMMICH_ALBUMS }), { status: 200 });
      }
      if (url.includes('/api/admin/pages')) {
        return new Response(JSON.stringify({ pages: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount() {
  return render(
    <NotificationProvider>
      <ConfirmProvider>
        <PageBuilder />
      </ConfirmProvider>
    </NotificationProvider>,
  );
}

describe('Subpage sections workflow (#929)', () => {
  it('migrates existing albums into the first section, omits Add Loose Album, supports search and undo', async () => {
    mount();

    // Open the Travel subpage in the right-hand editor panel.
    fireEvent.click(await screen.findByText('Travel'));
    expect(await screen.findByText('Kyoto Streets')).toBeTruthy();
    expect(screen.getByText('Osaka Night')).toBeTruthy();

    // Add the first section — both existing albums stay visible inside it.
    fireEvent.click(screen.getByRole('button', { name: '+ Add Section' }));
    expect(screen.getByText('Kyoto Streets')).toBeTruthy();
    expect(screen.getByText('Osaka Night')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Add Loose Album' })).toBeNull();

    // Search matches albums nested inside sections.
    const tree = screen.getByLabelText('Page structure');
    const search = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(search, { target: { value: 'Osaka' } });
    expect(within(tree).getByText('Travel')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'Nonexistent' } });
    expect(within(tree).queryByText('Travel')).toBeNull();
    fireEvent.change(search, { target: { value: '' } });

    // Deleting a section offers Undo and restores the section and its albums.
    fireEvent.click(screen.getByTitle('Remove section'));
    expect(screen.queryByText('Kyoto Streets')).toBeNull();

    const undoBtn = await screen.findByRole('button', { name: 'Undo' });
    fireEvent.click(undoBtn);
    expect(await screen.findByText('Kyoto Streets')).toBeTruthy();
    expect(screen.getByText('Osaka Night')).toBeTruthy();
  });
});
