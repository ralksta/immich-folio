// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

/**
 * State that belongs to one page or one opening of a dialog starts over with
 * the next (#864: these resets used to run in effects and are now made while
 * rendering).
 */

const nav = vi.hoisted(() => ({ pathname: '/admin' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import AdminDashboard from '../AdminDashboard';
import BackupManagerModal from '../BackupManagerModal';
import { NotificationProvider } from '../Notifications';

beforeEach(() => {
  nav.pathname = '/admin';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/admin/backups') {
        return Response.json({
          backups: {
            gallery: [
              {
                filename: 'gallery.yaml.2026-10-01T10-00-00-000Z.bak',
                target: 'gallery',
                timestamp: '2026-10-01T10:00:00.000Z',
                isPreRestore: false,
              },
            ],
          },
        });
      }
      return new Response(null, { status: 500 }); // status, doctor, messages
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the admin menu', () => {
  it('closes when the route changes', () => {
    const dashboard = () => (
      <NotificationProvider>
        <AdminDashboard onLogout={() => {}}>
          <div>Panel</div>
        </AdminDashboard>
      </NotificationProvider>
    );
    const { rerender } = render(dashboard());
    const toggle = () => screen.getByRole('button', { name: /menu/i });

    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');

    nav.pathname = '/admin/settings';
    rerender(dashboard());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('the backup dialog', () => {
  it('opens again without the confirmation left from last time', async () => {
    const modal = (isOpen: boolean) => (
      <BackupManagerModal isOpen={isOpen} onClose={() => {}} onRestoreSuccess={() => {}} />
    );
    const { rerender } = render(modal(true));

    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(screen.getByText('Confirm Restoration')).toBeTruthy();

    rerender(modal(false));
    rerender(modal(true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy());
    expect(screen.queryByText('Confirm Restoration')).toBeNull();
  });
});
