// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import AdminShell from '../AdminShell';
import { SESSION_EXPIRED_EVENT } from '../components/sessionExpiry';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

afterEach(cleanup);

/**
 * Sessions last 24 hours, but nothing re-checked authentication after the
 * mount-time check below — leave a tab open overnight and every admin
 * request answered 401 while the UI still looked signed in (#596).
 * SESSION_EXPIRED_EVENT, raised by any admin fetch call site that notices a
 * 401, is what this pins: it drops the whole panel back to the login screen
 * with an explanation, instead of each call site failing quietly.
 */
describe('AdminShell session expiry', () => {
  it('returns to the login screen with a notice when the session expires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/admin/auth') {
          return new Response(JSON.stringify({ authenticated: true, enabled: true }), {
            status: 200,
          });
        }
        // AdminDashboard's own status/doctor fetches — a failure there is
        // already handled as "unknown", not the thing under test here.
        return new Response(null, { status: 500 });
      }),
    );

    render(
      <AdminShell>
        <div>Panel content</div>
      </AdminShell>,
    );

    await waitFor(() => expect(screen.getByText('Panel content')).toBeTruthy());
    expect(screen.queryByLabelText('Password')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    });

    await waitFor(() =>
      expect(screen.getByText('Your session expired. Sign in again.')).toBeTruthy(),
    );
    expect(screen.queryByText('Panel content')).toBeNull();
  });

  it('shows no notice on an ordinary first visit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ authenticated: false, enabled: true }))),
    );

    render(
      <AdminShell>
        <div>Panel content</div>
      </AdminShell>,
    );

    await waitFor(() => expect(screen.getByLabelText('Password')).toBeTruthy());
    expect(screen.queryByText('Your session expired. Sign in again.')).toBeNull();
  });
});
