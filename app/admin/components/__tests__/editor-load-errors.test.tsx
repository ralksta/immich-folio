// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PageBuilder from '../PageBuilder';
import PagePanel from '../page-builder/PagePanel';
import PrivacyEditor from '../PrivacyEditor';
import SettingsEditor from '../SettingsEditor';
import { NotificationProvider } from '../Notifications';
import { ConfirmProvider } from '../ConfirmDialog';

const nav = vi.hoisted(() => ({ section: 'general' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  useParams: () => ({ section: nav.section }),
  usePathname: () => '/admin/settings/general',
}));

/**
 * #821: the editors that load a file now take adminGet's wording, which
 * carries the server's reason, and keep blocking a save over a file they could
 * not read (#595). The page builder reports the lists it can work without.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let route: (url: string) => Response;

beforeEach(() => {
  nav.section = 'general';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => route(String(input))),
  );
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wrap = (ui: React.ReactNode) => (
  <NotificationProvider>
    <ConfirmProvider>{ui}</ConfirmProvider>
  </NotificationProvider>
);

const EMPTY_GALLERY = { gallery: { hero: [], albums: [], subpages: [] }, version: 'v1' };
const NO_PAGES = { pages: [], taken: { subpages: [], albums: [], journal: [] } };

describe('PageBuilder', () => {
  it('shows why the structure did not load, with no builder to save', async () => {
    route = (url) =>
      url === '/api/admin/gallery' ? json({ error: 'disk full' }, 500) : json(NO_PAGES);
    render(wrap(<PageBuilder />));

    const alert = (await screen.findByText('The page structure could not be loaded.')).closest(
      '[role="alert"]',
    )!;
    expect(alert.textContent).toContain('Could not load (HTTP 500): disk full.');
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
  });

  it('says when the album and page lists fail, and still opens the builder', async () => {
    route = (url) =>
      url === '/api/admin/gallery'
        ? json(EMPTY_GALLERY)
        : url === '/api/admin/albums'
          ? json({ error: 'Immich is unreachable' }, 502)
          : json({ error: 'disk full' }, 500);
    render(wrap(<PageBuilder />));

    expect(await screen.findByRole('button', { name: 'New subpage' })).toBeTruthy();
    expect(await screen.findByText(/album picker is empty.*Immich is unreachable/)).toBeTruthy();
    expect(screen.getByText(/content pages did not load.*disk full/)).toBeTruthy();
  });
});

describe('PagePanel', () => {
  const props = {
    inMenu: false,
    onToggleMenu: () => {},
    taken: { subpages: [], albums: [], journal: [] },
    otherPageSlugs: [],
    onSaved: () => {},
    onDeleted: () => {},
  };

  it('names a missing file, and forgets the error when another page opens', async () => {
    route = (url) =>
      url === '/api/admin/pages/gone'
        ? json({ error: 'Page not found' }, 404)
        : json({ page: { rawMarkdown: '---\ntitle: "Contact"\n---\n\nHi\n' }, version: 'v1' });
    const { rerender } = render(wrap(<PagePanel slug="gone" {...props} />));

    expect(
      await screen.findByText('There is no file for this page in content/pages/.'),
    ).toBeTruthy();

    rerender(wrap(<PagePanel slug="contact" {...props} />));
    expect(screen.queryByText(/There is no file/)).toBeNull();
    expect(await screen.findByDisplayValue('Contact')).toBeTruthy();
  });

  it('passes on the server’s reason for any other failure', async () => {
    route = () => json({ error: 'disk full' }, 500);
    render(wrap(<PagePanel slug="contact" {...props} />));
    expect(await screen.findByText('Could not load (HTTP 500): disk full.')).toBeTruthy();
  });
});

describe('SettingsEditor', () => {
  it('shows the server’s reason and keeps saving off while settings are unknown', async () => {
    route = () => json({ error: 'disk full' }, 500);
    render(wrap(<SettingsEditor />));

    const alert = (await screen.findByText('Settings could not be loaded.')).closest(
      '[role="alert"]',
    )!;
    expect(alert.textContent).toContain('Could not load (HTTP 500): disk full.');
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
  });
});

describe('the About section', () => {
  it('shows the server’s reason when about.md does not load', async () => {
    nav.section = 'about';
    route = (url) =>
      url === '/api/admin/about'
        ? json({ error: 'disk full' }, 500)
        : json({ settings: {}, version: 'v1' });
    render(wrap(<SettingsEditor />));
    expect(await screen.findByText(/Could not load \(HTTP 500\): disk full\./)).toBeTruthy();
  });
});

describe('PrivacyEditor', () => {
  it('offers a retry instead of an editor over an unread policy', async () => {
    let answer = () => json({ error: 'disk full' }, 500);
    route = () => answer();
    render(wrap(<PrivacyEditor />));

    expect(await screen.findByText(/HTTP 500.*disk full/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();

    answer = () =>
      json({ body: 'Our policy', enabled: true, facts: [], starter: '', version: 'v1' });
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(screen.queryByText(/HTTP 500/)).toBeNull());
    expect(await screen.findByDisplayValue('Our policy')).toBeTruthy();
  });
});
