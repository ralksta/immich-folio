// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SettingsEditor from '../SettingsEditor';
import { NotificationProvider } from '../Notifications';
import { ConfirmProvider } from '../ConfirmDialog';

const nav = vi.hoisted(() => ({ section: 'grid' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  useParams: () => ({ section: nav.section }),
  usePathname: () => `/admin/settings/${nav.section}`,
}));

/**
 * A value the site would ignore is named next to its input as it is typed,
 * not only after a refused save (QA A-14).
 */
beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ settings: { title: 'Folio' }, version: 'v1', envLocks: {} }),
          {
            status: 200,
          },
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
        <SettingsEditor />
      </ConfirmProvider>
    </NotificationProvider>,
  );
}

describe('Settings form: values the site would ignore', () => {
  it('marks grid columns outside 1–6 at the input', async () => {
    nav.section = 'grid';
    mount();
    const columns = (await screen.findByLabelText(/Columns/)) as HTMLInputElement;
    expect(columns.getAttribute('aria-invalid')).toBeNull();

    fireEvent.change(columns, { target: { value: '9' } });
    expect(columns.getAttribute('aria-invalid')).toBe('true');
    const error = document.getElementById(columns.getAttribute('aria-describedby')!);
    expect(error?.textContent).toBe('Must be a whole number from 1 to 6.');

    fireEvent.change(columns, { target: { value: '4' } });
    expect(columns.getAttribute('aria-invalid')).toBeNull();
  });

  it('marks an accent that is not hex', async () => {
    nav.section = 'theme';
    mount();
    const accent = (await screen.findByLabelText('Accent colour (hex)')) as HTMLInputElement;
    fireEvent.change(accent, { target: { value: 'rot' } });
    expect(accent.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Must be a hex colour such as #e60012.')).toBeTruthy();
  });
});
