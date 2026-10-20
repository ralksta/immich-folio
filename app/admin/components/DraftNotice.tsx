'use client';

import type { DraftStatus } from './useDraft';
import { useAdminDictionary } from './AdminI18n';
import type { AdminDictionary } from '@/lib/i18n/admin';

/** What a draft can belong to; the words come from the shell dictionary. */
export type DraftSubject = keyof AdminDictionary['shell']['draft']['subjects'];

interface DraftNoticeProps {
  status: DraftStatus;
  /** What the draft belongs to, e.g. the page structure or an entry. */
  subject: DraftSubject;
  onDiscard: () => void;
  onRestore: () => void;
  onDismiss: () => void;
}

/**
 * Tells the operator that unsaved edits came back — or could not come back on
 * their own (#592). A restored draft must never look like the saved state: it
 * is still unsaved, and the save bar says so, but without this line the edits
 * would simply be there with no hint of where they came from.
 */
export default function DraftNotice({
  status,
  subject,
  onDiscard,
  onRestore,
  onDismiss,
}: DraftNoticeProps) {
  const t = useAdminDictionary().shell.draft;
  if (status === 'none') return null;
  const what = t.subjects[subject];

  return (
    <div className="admin-notice draft-notice" role="status">
      {status === 'restored' ? (
        <>
          <span>{t.restored(what)}</span>
          <span className="draft-notice-actions">
            <button type="button" className="admin-btn admin-btn-xs" onClick={onDiscard}>
              {t.discardChanges}
            </button>
            <button type="button" className="admin-btn admin-btn-xs" onClick={onDismiss}>
              {t.ok}
            </button>
          </span>
        </>
      ) : (
        <>
          <span>{t.stale(what)}</span>
          <span className="draft-notice-actions">
            <button type="button" className="admin-btn admin-btn-xs" onClick={onRestore}>
              {t.restore}
            </button>
            <button type="button" className="admin-btn admin-btn-xs" onClick={onDiscard}>
              {t.discardThem}
            </button>
          </span>
        </>
      )}
    </div>
  );
}
