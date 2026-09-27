'use client';

/**
 * The admin's one place to say that something happened (#600).
 *
 * Replaces `alert()`, which blocked the page, could not be styled and said
 * nothing to a screen reader beyond the dialog itself. A notification here has
 * an explicit kind rather than one guessed from its wording, can be dismissed,
 * and is announced: errors through an assertive live region, successes through
 * a polite one. Successes leave on their own after a few seconds; errors stay
 * until dismissed, because an error nobody saw did not get reported.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { IconX } from './Icons';

export type NotificationKind = 'success' | 'error';

/** One button on a notification, e.g. Undo after a removal. */
export interface NotificationAction {
  label: string;
  run: () => void;
}

interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
  action?: NotificationAction;
}

type Notify = (kind: NotificationKind, message: string, action?: NotificationAction) => void;

/**
 * Outside the provider (a component rendered on its own in a test) notifying
 * does nothing rather than throwing.
 */
const NotifyContext = createContext<Notify>(() => {});

export function useNotify(): Notify {
  return useContext(NotifyContext);
}

const SUCCESS_MS = 4000;
const ACTION_MS = 8000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback<Notify>(
    (kind, message, action) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, kind, message, action }]);
      // Longer with an action: there has to be time to reach the button.
      if (kind === 'success') setTimeout(() => dismiss(id), action ? ACTION_MS : SUCCESS_MS);
    },
    [dismiss],
  );

  const render = (kind: NotificationKind) =>
    items
      .filter((n) => n.kind === kind)
      .map((n) => (
        <div key={n.id} className={`admin-notification admin-notification--${n.kind}`}>
          <span className="admin-notification__text">{n.message}</span>
          {n.action && (
            <button
              type="button"
              className="admin-notification__action"
              onClick={() => {
                n.action!.run();
                dismiss(n.id);
              }}
            >
              {n.action.label}
            </button>
          )}
          <button
            type="button"
            className="admin-notification__close"
            onClick={() => dismiss(n.id)}
            aria-label="Dismiss"
          >
            <IconX size={14} />
          </button>
        </div>
      ));

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <div className="admin-notifications">
        {/* Two regions, because politeness belongs to the region, not the message. */}
        <div role="alert" aria-live="assertive" className="admin-notifications__group">
          {render('error')}
        </div>
        <div role="status" aria-live="polite" className="admin-notifications__group">
          {render('success')}
        </div>
      </div>
    </NotifyContext.Provider>
  );
}
