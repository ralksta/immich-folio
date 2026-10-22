// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SubpagePreview from '../page-builder/SubpagePreview';
import { JournalEditor } from '../journal/JournalEditor';
import { ConfirmProvider } from '../ConfirmDialog';
import { NotificationProvider } from '../Notifications';

/**
 * #821: two loads used to swallow their failures. The subpage preview fell
 * back to three columns and English without a word, and the journal editor
 * opened its album picker on an empty list, which reads as "no albums in
 * Immich". Both now say what failed and let the admin try again.
 */

type Route = (url: string) => Response | undefined;

let route: Route;
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = String(input);
  const res = route(url);
  if (!res) throw new Error(`Unexpected fetch: ${url}`);
  return res;
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('the subpage preview', () => {
  const subpage = {
    name: 'Trips',
    albums: [{ id: 'a1' }, { id: 'a2' }],
  } as unknown as Parameters<typeof SubpagePreview>[0]['sp'];

  it('says it uses the defaults when the site settings fail, and recovers on retry', async () => {
    route = (url) =>
      url === '/api/admin/settings' ? json({ error: 'disk full' }, 500) : undefined;
    const { container } = render(<SubpagePreview sp={subpage} immichAlbums={[]} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('default grid and English');
    expect(alert.textContent).toContain('HTTP 500');
    expect(alert.textContent).toContain('disk full');
    // The preview is still drawn, with the defaults it names.
    const grid = container.querySelector<HTMLElement>('.subpage-grid');
    expect(grid?.style.getPropertyValue('--subpage-columns')).toBe('3');

    route = (url) =>
      url === '/api/admin/settings'
        ? json({ settings: { grid: { columns: 4 }, lang: 'de' } })
        : undefined;
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(grid?.style.getPropertyValue('--subpage-columns')).toBe('4');
    expect(container.textContent).toContain('2 Alben');
  });
});

describe('the journal editor’s album picker', () => {
  const entry = json({
    entry: { slug: 'story', rawMarkdown: '---\ntitle: "Story"\n---\n\n::album\n' },
    version: 'v1',
  });

  function renderEditor() {
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
  }

  it('reports a failed album list instead of opening on an empty one, and retries', async () => {
    let albums = json({ error: 'Immich is unreachable' }, 502);
    route = (url) =>
      url === '/api/admin/journal/story'
        ? entry.clone()
        : url === '/api/admin/albums'
          ? albums
          : undefined;
    renderEditor();

    fireEvent.click(await screen.findByRole('button', { name: /Pick album/ }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toContain('Album list:'));
    expect(alert.textContent).toContain('HTTP 502');
    expect(alert.textContent).toContain('Immich is unreachable');
    expect(screen.queryByRole('dialog', { name: 'Select Album' })).toBeNull();

    albums = json({
      albums: [
        {
          id: 'trip',
          albumName: 'Summer trip',
          description: '',
          thumbnailAssetId: null,
          assetCount: 2,
          isConfigured: false,
        },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /Pick album/ }));
    expect(await screen.findByRole('dialog', { name: 'Select Album' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Summer trip/ })).toBeTruthy();
  });

  it('reports a failed entry, offers no editor to save over it, and loads on retry', async () => {
    let answer = json({ error: 'disk full' }, 500);
    route = (url) => (url === '/api/admin/journal/story' ? answer : undefined);
    renderEditor();

    const alert = (await screen.findByText('This entry could not be loaded.')).closest(
      '[role="alert"]',
    )!;
    expect(alert.textContent).toContain('HTTP 500');
    expect(alert.textContent).toContain('disk full');
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();

    answer = entry.clone();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /Pick album/ })).toBeTruthy();
  });
});

describe('an album block’s photos', () => {
  const assetsUrl = '/api/admin/albums/trip/assets?types=all';
  const entry = () =>
    json({
      entry: { slug: 'story', rawMarkdown: '---\ntitle: "Story"\n---\n\n::album trip\n' },
      version: 'v1',
    });
  const assets = () => json({ assets: [{ id: 'p1' }, { id: 'p2' }] });

  function renderEditor() {
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
  }

  it('show why they did not load, and load on the next edit', async () => {
    let answer = json({ error: 'Immich is unreachable' }, 502);
    route = (url) =>
      url === '/api/admin/journal/story' ? entry() : url === assetsUrl ? answer : undefined;
    renderEditor();

    expect(await screen.findByText(/HTTP 502.*Immich is unreachable/)).toBeTruthy();

    answer = assets();
    fireEvent.click(screen.getByRole('button', { name: '+ Text' }));
    expect(await screen.findByText('2 photos in album')).toBeTruthy();
    expect(screen.queryByText(/HTTP 502/)).toBeNull();
  });

  it('still arrive when the author edits while they load', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    route = (url) => (url === '/api/admin/journal/story' ? entry() : undefined);
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === assetsUrl) {
        await held;
        return assets();
      }
      const res = route(url);
      if (!res) throw new Error(`Unexpected fetch: ${url}`);
      return res;
    });
    renderEditor();

    fireEvent.click(await screen.findByRole('button', { name: '+ Text' }));
    release();
    expect(await screen.findByText('2 photos in album')).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === assetsUrl)).toHaveLength(1);
  });
});
