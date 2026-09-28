// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { JournalEditor } from '../journal/JournalEditor';
import PrivacyEditor from '../PrivacyEditor';
import SettingsEditor from '../SettingsEditor';
import PageBuilder from '../PageBuilder';
import { NotificationProvider } from '../Notifications';
import { ConfirmProvider } from '../ConfirmDialog';

const nav = vi.hoisted(() => ({ section: 'general' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  useParams: () => ({ section: nav.section }),
  usePathname: () => '/admin/settings/general',
}));

/**
 * A save handler closes over the state it started with. Typing on while the
 * request is out used to be marked saved when the answer came back: the Save
 * button went to "Saved" and disabled, the unsaved-changes guard and the draft
 * let go, and leaving the editor threw those edits away. Where the server
 * rewrote the text (a hashed password line), the newer text was also replaced
 * by the file as written.
 */

/** A PUT that answers only when the test says so. */
let releasePut: ((written?: string) => void) | null = null;
let putBodies: unknown[] = [];

function stubFetch(
  loadResponse: unknown,
  putResponse: (sent: Record<string, unknown>, written?: string) => unknown,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const sent = JSON.parse(init.body as string) as Record<string, unknown>;
        putBodies.push(sent);
        const written = await new Promise<string | undefined>((resolve) => {
          releasePut = resolve;
        });
        return new Response(JSON.stringify(putResponse(sent, written)), { status: 200 });
      }
      const body = typeof loadResponse === 'function' ? loadResponse(_url) : loadResponse;
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

beforeEach(() => {
  nav.section = 'general';
  releasePut = null;
  putBodies = [];
  // Node 26 defines its own global localStorage (undefined without
  // --localstorage-file), which shadows jsdom's; give the editor a working one.
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

const ENTRY = '---\ntitle: "Trip"\n---\n\nHello\n';

async function renderJournal() {
  stubFetch({ entry: { slug: 'trip', rawMarkdown: ENTRY }, version: 'v1' }, (sent, written) => ({
    success: true,
    entry: { slug: 'trip', rawMarkdown: written ?? sent.rawMarkdown },
    version: 'v2',
  }));
  render(
    <NotificationProvider>
      <ConfirmProvider>
        <JournalEditor slug="trip" onBack={() => {}} />
      </ConfirmProvider>
    </NotificationProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Raw Markdown' }));
  return screen.getByPlaceholderText('Write Markdown here...') as HTMLTextAreaElement;
}

describe('JournalEditor: edits made while a save is in flight', () => {
  it('stay unsaved and saveable', async () => {
    const editor = await renderJournal();
    fireEvent.change(editor, { target: { value: `${ENTRY}First\n` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(releasePut).not.toBeNull());

    fireEvent.change(editor, { target: { value: `${ENTRY}First\nSecond\n` } });
    await act(async () => releasePut!());

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Saving...' })).toBeNull());
    expect(editor.value).toBe(`${ENTRY}First\nSecond\n`);
    const save = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    // Still kept as a draft, so leaving the editor does not lose it.
    expect(window.sessionStorage.getItem('folio_draft_journal-trip')).toContain('Second');
  });

  it('are not replaced by the file as written', async () => {
    const editor = await renderJournal();
    fireEvent.change(editor, { target: { value: `${ENTRY}First\n` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(releasePut).not.toBeNull());

    fireEvent.change(editor, { target: { value: `${ENTRY}First\nSecond\n` } });
    // The server rewrote what it was sent, as it does when it hashes a password.
    await act(async () => releasePut!(`${ENTRY}First (as written)\n`));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Saving...' })).toBeNull());
    expect(editor.value).toBe(`${ENTRY}First\nSecond\n`);
  });

  it('a save with no edits meanwhile still ends clean, showing the file as written', async () => {
    const editor = await renderJournal();
    fireEvent.change(editor, { target: { value: `${ENTRY}First\n` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(releasePut).not.toBeNull());
    await act(async () => releasePut!(`${ENTRY}First (as written)\n`));

    await screen.findByRole('button', { name: /Saved/ });
    expect(editor.value).toBe(`${ENTRY}First (as written)\n`);
    expect(window.sessionStorage.getItem('folio_draft_journal-trip')).toBeNull();
  });
});

describe('PrivacyEditor: edits made while a save is in flight', () => {
  it('stay unsaved and saveable', async () => {
    stubFetch(
      { body: 'Old', enabled: true, facts: [], starter: '## Controller', version: 'v1' },
      () => ({ success: true, version: 'v2' }),
    );
    render(
      <NotificationProvider>
        <ConfirmProvider>
          <PrivacyEditor />
        </ConfirmProvider>
      </NotificationProvider>,
    );
    const editor = (await screen.findByLabelText(
      'Privacy policy (Markdown)',
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save privacy policy' }));
    await waitFor(() => expect(releasePut).not.toBeNull());

    fireEvent.change(editor, { target: { value: 'First and second' } });
    await act(async () => releasePut!());

    await screen.findByText('Privacy policy saved.');
    const save = screen.getByRole('button', { name: 'Save privacy policy' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(putBodies).toEqual([{ body: 'First' }]);
  });
});

describe('SettingsEditor: edits made while a save is in flight', () => {
  it('stay unsaved and saveable', async () => {
    stubFetch({ settings: { title: 'Old' }, version: 'v1', envLocks: {} }, () => ({
      success: true,
      version: 'v2',
    }));
    render(
      <NotificationProvider>
        <ConfirmProvider>
          <SettingsEditor />
        </ConfirmProvider>
      </NotificationProvider>,
    );
    const title = (await screen.findByLabelText('Site Title')) as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(releasePut).not.toBeNull());

    fireEvent.change(title, { target: { value: 'First and second' } });
    await act(async () => releasePut!());

    await screen.findByText('Saved!');
    expect(title.value).toBe('First and second');
    const save = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(window.sessionStorage.getItem('folio_draft_settings')).toContain('First and second');
  });
});

describe('About editor: edits made while a save is in flight', () => {
  it('stay unsaved and saveable', async () => {
    nav.section = 'about';
    stubFetch(
      (url: string) =>
        url === '/api/admin/about'
          ? { meta: { name: 'Ada' }, body: 'Old', version: 'v1' }
          : { settings: {}, version: 'v1', envLocks: {} },
      () => ({ success: true, version: 'v2' }),
    );
    render(
      <NotificationProvider>
        <ConfirmProvider>
          <SettingsEditor />
        </ConfirmProvider>
      </NotificationProvider>,
    );
    const bio = (await screen.findByLabelText('Biography (Markdown)')) as HTMLTextAreaElement;
    fireEvent.change(bio, { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(releasePut).not.toBeNull());

    fireEvent.change(bio, { target: { value: 'First and second' } });
    await act(async () => releasePut!());

    await screen.findByText('Saved!');
    expect(bio.value).toBe('First and second');
    const save = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(window.sessionStorage.getItem('folio_draft_about')).toContain('First and second');
  });
});

describe('PageBuilder: edits made while a save is in flight', () => {
  it('stay unsaved and saveable, and are not replaced by the file as written', async () => {
    stubFetch(
      (url: string) =>
        url === '/api/admin/gallery'
          ? { gallery: { hero: [], albums: [], subpages: [] }, version: 'v1' }
          : url === '/api/admin/albums'
            ? { albums: [] }
            : { pages: [], taken: { subpages: [], albums: [], journal: [] } },
      // As written: hashed passwords make the server copy differ from the one sent.
      (sent) => ({
        success: true,
        version: 'v2',
        gallery: { ...(sent.gallery as object), hero: ['written-by-server'] },
      }),
    );
    render(
      <NotificationProvider>
        <ConfirmProvider>
          <PageBuilder />
        </ConfirmProvider>
      </NotificationProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /New subpage/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(releasePut).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /New subpage/ }));
    await act(async () => releasePut!());

    await screen.findByText('Saved successfully!');
    const save = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    const kept = JSON.parse(window.sessionStorage.getItem('folio_draft_page-builder') ?? 'null');
    expect(kept?.value?.subpages).toHaveLength(2);
    expect((putBodies[0] as { gallery: { subpages: unknown[] } }).gallery.subpages).toHaveLength(1);
  });
});
