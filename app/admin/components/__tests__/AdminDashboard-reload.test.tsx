// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';
import { SESSION_EXPIRED_EVENT } from '../sessionExpiry';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

afterEach(cleanup);

/**
 * `handleReload` used to await POST /api/admin/reload without checking
 * `res.ok`, so a 401 or a 500 was indistinguishable from success (#596).
 */
describe('AdminDashboard reload failure reporting', () => {
  it('reports a non-ok, non-401 reload failure', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/admin/reload' && init?.method === 'POST') {
          return new Response(null, { status: 500 });
        }
        return new Response(null, { status: 500 }); // status/doctor probes
      }),
    );

    render(
      <AdminDashboard onLogout={() => {}}>
        <div>Panel</div>
      </AdminDashboard>,
    );

    fireEvent.click(screen.getByTitle('Reload config & clear cache'));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Reload failed (HTTP 500).'));
  });

  it('raises the session-expired event instead of alerting on a 401', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/admin/reload' && init?.method === 'POST') {
          return new Response(null, { status: 401 });
        }
        return new Response(null, { status: 500 });
      }),
    );

    render(
      <AdminDashboard onLogout={() => {}}>
        <div>Panel</div>
      </AdminDashboard>,
    );

    fireEvent.click(screen.getByTitle('Reload config & clear cache'));

    await waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(alertMock).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it('does not alert when the reload succeeds', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/reload' && init?.method === 'POST') {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AdminDashboard onLogout={() => {}}>
        <div>Panel</div>
      </AdminDashboard>,
    );

    fireEvent.click(screen.getByTitle('Reload config & clear cache'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url, init]) => url === '/api/admin/reload' && init?.method === 'POST',
        ),
      ).toHaveLength(1),
    );
    expect(alertMock).not.toHaveBeenCalled();
  });
});
