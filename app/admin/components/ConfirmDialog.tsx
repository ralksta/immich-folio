'use client';

/**
 * One confirmation for the admin (UX stage 3, #694 §3), replacing the
 * browser's `confirm()`, which cannot be styled, blocks the tab and reads the
 * same for "discard a draft" and "delete a file".
 *
 * Policy: ask only before something that is permanent or takes effect at
 * once (deleting a message, a journal entry, the uploaded favicon). Removals
 * of unsaved state are undone by not saving and do not need a dialog.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete message?', confirmLabel: 'Delete', danger: true }))) return;
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useModalDialog } from '@/hooks/useModalDialog';

export interface ConfirmOptions {
  title: string;
  /** What happens, in one or two sentences. */
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive: the confirm button uses the error colour. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

/** One button of a choice; `id` is what the promise resolves to. */
export interface ChoiceAction<Id extends string> {
  id: Id;
  label: string;
  danger?: boolean;
}

/**
 * More than yes or no — the concurrent-edit prompt (#601) offers three ways
 * out. The cancel button (and Esc, and the backdrop) resolves to null.
 */
export interface ChoiceOptions<Id extends string> {
  title: string;
  message?: ReactNode;
  /** Left to right; the last one is the primary button. */
  actions: ChoiceAction<Id>[];
  cancelLabel?: string;
}

type Choose = <Id extends string>(options: ChoiceOptions<Id>) => Promise<Id | null>;

interface DialogContext {
  confirm: Confirm;
  choose: Choose;
}

/** Outside the provider (a component tested on its own) it falls back to window.confirm. */
const ConfirmContext = createContext<DialogContext>({
  confirm: async (o) => (typeof window === 'undefined' ? false : window.confirm(o.title)),
  choose: async (o) =>
    typeof window !== 'undefined' && window.confirm(o.title)
      ? (o.actions[o.actions.length - 1]?.id ?? null)
      : null,
});

export function useConfirm(): Confirm {
  return useContext(ConfirmContext).confirm;
}

export function useChoice(): Choose {
  return useContext(ConfirmContext).choose;
}

const CONFIRM_ID = 'confirm';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ChoiceOptions<string> | null>(null);
  const resolver = useRef<((id: string | null) => void) | null>(null);

  const choose = useCallback(
    (options: ChoiceOptions<string>) =>
      new Promise<string | null>((resolve) => {
        resolver.current?.(null);
        resolver.current = resolve;
        setPending(options);
      }),
    [],
  ) as Choose;

  const confirm = useCallback<Confirm>(
    async (options) =>
      (await choose({
        title: options.title,
        message: options.message,
        cancelLabel: options.cancelLabel,
        actions: [
          {
            id: CONFIRM_ID,
            label: options.confirmLabel ?? 'Confirm',
            danger: options.danger,
          },
        ],
      })) === CONFIRM_ID,
    [choose],
  );

  const settle = useCallback((id: string | null) => {
    resolver.current?.(id);
    resolver.current = null;
    setPending(null);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, choose }}>
      {children}
      {pending && <Dialog options={pending} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

function Dialog({
  options,
  onSettle,
}: {
  options: ChoiceOptions<string>;
  onSettle: (id: string | null) => void;
}) {
  // Esc cancels, focus is trapped and returned (the same hook the modals use).
  const cardRef = useModalDialog(() => onSettle(null));
  const last = options.actions.length - 1;
  return (
    <div className="confirm-backdrop" onClick={() => onSettle(null)}>
      <div
        ref={cardRef}
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? 'confirm-message' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="confirm-title">
          {options.title}
        </h2>
        {options.message && (
          <p id="confirm-message" className="confirm-message">
            {options.message}
          </p>
        )}
        <div className="confirm-actions">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => onSettle(null)}
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          {options.actions.map((action, i) => (
            <button
              key={action.id}
              type="button"
              className={`admin-btn ${
                action.danger
                  ? 'confirm-danger'
                  : i === last
                    ? 'admin-btn-primary'
                    : 'admin-btn-ghost'
              }`}
              onClick={() => onSettle(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
