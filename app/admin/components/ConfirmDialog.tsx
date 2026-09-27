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

/** Outside the provider (a component tested on its own) it falls back to window.confirm. */
const ConfirmContext = createContext<Confirm>(async (o) =>
  typeof window === 'undefined' ? false : window.confirm(o.title),
);

export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setPending(options);
      }),
    [],
  );

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <Dialog options={pending} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

function Dialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (ok: boolean) => void;
}) {
  // Esc cancels, focus is trapped and returned (the same hook the modals use).
  const cardRef = useModalDialog(() => onSettle(false));
  return (
    <div className="confirm-backdrop" onClick={() => onSettle(false)}>
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
            onClick={() => onSettle(false)}
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            className={`admin-btn ${options.danger ? 'confirm-danger' : 'admin-btn-primary'}`}
            onClick={() => onSettle(true)}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
