// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmProvider, useChoice, useConfirm } from '../components/ConfirmDialog';

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

/** The concurrent-edit prompt (#601): more than two ways out. */
function ChoiceTrigger({ onResult }: { onResult: (id: string | null) => void }) {
  const choose = useChoice();
  return (
    <button
      onClick={async () =>
        onResult(
          await choose({
            title: 'Changed elsewhere',
            actions: [
              { id: 'overwrite', label: 'Overwrite anyway' },
              { id: 'reload', label: 'Reload (discard mine)' },
            ],
            cancelLabel: 'Keep editing',
          }),
        )
      }
    >
      choose
    </button>
  );
}

describe('useChoice', () => {
  it('resolves to the picked action, or null on cancel', async () => {
    const results: (string | null)[] = [];
    render(
      <ConfirmProvider>
        <ChoiceTrigger onResult={(id) => results.push(id)} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText('choose'));
    fireEvent.click(screen.getByRole('button', { name: 'Reload (discard mine)' }));
    await waitFor(() => expect(results).toEqual(['reload']));
    fireEvent.click(screen.getByText('choose'));
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite anyway' }));
    await waitFor(() => expect(results).toEqual(['reload', 'overwrite']));
    fireEvent.click(screen.getByText('choose'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(results).toEqual(['reload', 'overwrite', null]));
  });
});
