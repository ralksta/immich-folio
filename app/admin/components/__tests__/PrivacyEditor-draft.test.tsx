// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import PrivacyEditor from '../PrivacyEditor';
import { NotificationProvider } from '../Notifications';
import { ConfirmProvider } from '../ConfirmDialog';

/**
 * The privacy editor sits in Settings → Legal and unmounts when another
 * section opens. An unsaved policy used to go with it (A-7); it now keeps a
 * draft like the About editor (#554, #592).
 */

let serverBody = 'Saved policy';

beforeEach(() => {
  serverBody = 'Saved policy';
  window.sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            body: serverBody,
            enabled: true,
            facts: [],
            starter: '## Controller',
            version: 'v1',
          }),
          { status: 200 },
        ),
    ),
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
        <PrivacyEditor />
      </ConfirmProvider>
    </NotificationProvider>,
  );
}

const editor = async () =>
  (await screen.findByLabelText('Privacy policy (Markdown)')) as HTMLTextAreaElement;

describe('PrivacyEditor draft (A-7)', () => {
  it('brings back unsaved text after the editor was unmounted', async () => {
    const first = mount();
    fireEvent.change(await editor(), { target: { value: 'Unsaved policy' } });
    first.unmount();

    mount();
    expect((await editor()).value).toBe('Unsaved policy');
    expect(screen.getByText(/unsaved changes to the privacy policy were restored/)).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save privacy policy' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
  });

  it('discarding the draft shows the saved policy again', async () => {
    const first = mount();
    fireEvent.change(await editor(), { target: { value: 'Unsaved policy' } });
    first.unmount();

    mount();
    await editor();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect((await editor()).value).toBe('Saved policy');
    await waitFor(() => expect(window.sessionStorage.getItem('folio_draft_privacy')).toBeNull());
  });

  it('holds a draft back when the file changed since, and asks', async () => {
    const first = mount();
    fireEvent.change(await editor(), { target: { value: 'Unsaved policy' } });
    first.unmount();

    serverBody = 'Changed in another tab';
    mount();
    expect((await editor()).value).toBe('Changed in another tab');
    fireEvent.click(screen.getByRole('button', { name: 'Restore my changes' }));
    expect((await editor()).value).toBe('Unsaved policy');
  });
});
