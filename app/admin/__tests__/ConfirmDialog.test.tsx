// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from '../components/ConfirmDialog';

afterEach(cleanup);

/** UX stage 3 (#694 §3): what replaced window.confirm in the admin. */
function Trigger({ onResult }: { onResult: (ok: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () =>
        onResult(
          await confirm({
            title: 'Delete it?',
            message: 'Gone for good.',
            confirmLabel: 'Delete',
            danger: true,
          }),
        )
      }
    >
      go
    </button>
  );
}

function setup() {
  const results: boolean[] = [];
  render(
    <ConfirmProvider>
      <Trigger onResult={(ok) => results.push(ok)} />
    </ConfirmProvider>,
  );
  fireEvent.click(screen.getByText('go'));
  return results;
}

describe('ConfirmDialog', () => {
  it('asks in an alertdialog named by its title', () => {
    setup();
    const dialog = screen.getByRole('alertdialog', { name: 'Delete it?' });
    expect(dialog.textContent).toContain('Gone for good.');
  });

  it('resolves true on confirm and closes', async () => {
    const results = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(results).toEqual([true]));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resolves false on cancel, and on Escape', async () => {
    const results = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(results).toEqual([false]));
    fireEvent.click(screen.getByText('go'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(results).toEqual([false, false]));
  });
});
