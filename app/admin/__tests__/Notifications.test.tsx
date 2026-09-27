// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { NotificationProvider, useNotify } from '../components/Notifications';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Trigger({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  const notify = useNotify();
  return <button onClick={() => notify(kind, message)}>go</button>;
}

/** #600: what replaced alert() in the admin. */
describe('admin notifications', () => {
  it('announces an error assertively and keeps it until dismissed', () => {
    vi.useFakeTimers();
    render(
      <NotificationProvider>
        <Trigger kind="error" message="Save failed" />
      </NotificationProvider>,
    );
    fireEvent.click(screen.getByText('go'));

    expect(screen.getByRole('alert').textContent).toContain('Save failed');
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText('Save failed')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Save failed')).toBeNull();
  });

  it('announces a success politely and lets it go on its own', () => {
    vi.useFakeTimers();
    render(
      <NotificationProvider>
        <Trigger kind="success" message="Saved" />
      </NotificationProvider>,
    );
    fireEvent.click(screen.getByText('go'));

    expect(screen.getByRole('status').textContent).toContain('Saved');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('does nothing outside the provider instead of throwing', () => {
    render(<Trigger kind="error" message="x" />);
    expect(() => fireEvent.click(screen.getByText('go'))).not.toThrow();
  });

  it('runs an action once and closes the notification', () => {
    let runs = 0;
    function WithAction() {
      const notify = useNotify();
      return (
        <button onClick={() => notify('success', 'Removed', { label: 'Undo', run: () => runs++ })}>
          go
        </button>
      );
    }
    render(
      <NotificationProvider>
        <WithAction />
      </NotificationProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(runs).toBe(1);
    expect(screen.queryByText('Removed')).toBeNull();
  });
});
