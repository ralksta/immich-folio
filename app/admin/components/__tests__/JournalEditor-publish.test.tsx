// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { JournalEditor } from '../journal/JournalEditor';
import { NotificationProvider } from '../Notifications';
import { ConfirmProvider } from '../ConfirmDialog';

/**
 * The page editor's Publish button flips the Draft flag and saves at once
 * (#722). When that save fails, the flipped flag is an unsaved edit: the editor
 * has to say so and keep it saveable, not show "Saved" over a page that is
 * still a draft on disk.
 */

const MARKDOWN = '---\ntitle: "FAQ"\ndraft: true\n---\n\nHello\n';

let putStatus = 500;

beforeEach(() => {
  putStatus = 500;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        if (putStatus !== 200) {
          return new Response(JSON.stringify({ error: 'Failed to save page' }), {
            status: putStatus,
          });
        }
        const sent = JSON.parse(init.body as string) as { rawMarkdown: string };
        return new Response(
          JSON.stringify({
            success: true,
            page: { slug: 'faq', rawMarkdown: sent.rawMarkdown },
            version: 'v2',
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ page: { slug: 'faq', rawMarkdown: MARKDOWN }, version: 'v1' }),
        { status: 200 },
      );
    }),
  );
  // Node 26 defines its own global localStorage (undefined without
  // --localstorage-file), which shadows jsdom's; give the editor a working one.
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  // Drafts live in sessionStorage; each test starts without one.
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderEditor() {
  return render(
    <NotificationProvider>
      <ConfirmProvider>
        <JournalEditor slug="faq" kind="page" onBack={() => {}} />
      </ConfirmProvider>
    </NotificationProvider>,
  );
}

describe('JournalEditor page mode: Publish', () => {
  it('leaves a failed publish as an unsaved change', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Failed to save page'),
    );
    const save = screen.getByRole('button', { name: 'Save Changes' });
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });

  it('reads Saved after a publish that went through', async () => {
    putStatus = 200;
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    await screen.findByRole('button', { name: 'Unpublish' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Saved/ })).toBeTruthy());
  });
});
