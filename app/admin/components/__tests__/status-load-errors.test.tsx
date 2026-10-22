// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';
import DiagnosticsView from '../DiagnosticsView';
import { NotificationProvider } from '../Notifications';
import { SESSION_EXPIRED_EVENT } from '../sessionExpiry';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

/**
 * #821: the status probes and the diagnostics run go through adminGet. A
 * failed probe still reads as "unknown" rather than "broken", but a 401 now
 * signs the panel out from here too, and a failed run says why.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function stub(handler: (url: string) => Response) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => handler(String(input)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the dashboard’s status probes', () => {
  it('raise the session-expired event on a 401', async () => {
    // Only the status probe answers 401; the unread count already did before.
    stub((url) =>
      url === '/api/admin/status'
        ? json({}, 401)
        : url === '/api/admin/messages'
          ? json({ messages: [] })
          : json({}),
    );
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    render(
      <NotificationProvider>
        <AdminDashboard onLogout={() => {}}>
          <div>Panel</div>
        </AdminDashboard>
      </NotificationProvider>,
    );
    await waitFor(() => expect(expired).toHaveBeenCalled());
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });
});

describe('DiagnosticsView', () => {
  it('says why a run failed, with the server’s reason', async () => {
    stub((url) =>
      url === '/api/admin/doctor' ? json({ error: 'Immich is unreachable' }, 502) : json({}, 500),
    );
    render(<DiagnosticsView />);
    expect(
      await screen.findByText(
        'Diagnostics failed. Could not load (HTTP 502): Immich is unreachable.',
      ),
    ).toBeTruthy();
  });

  it('shows the findings when only the alt-text report fails', async () => {
    stub((url) =>
      url === '/api/admin/doctor'
        ? json({
            level: 'warn',
            findings: [{ id: 'x', level: 'warn', title: 'Something to look at', detail: '' }],
          })
        : json({ error: 'slow' }, 500),
    );
    render(<DiagnosticsView />);
    expect(await screen.findByText('Something to look at')).toBeTruthy();
    expect(screen.queryByText(/Diagnostics failed/)).toBeNull();
  });
});
