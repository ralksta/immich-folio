'use client';

import type { DraftStatus } from './useDraft';

interface DraftNoticeProps {
  status: DraftStatus;
  /** What the draft belongs to, e.g. "page structure" or "entry". */
  subject: string;
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
  if (status === 'none') return null;

  return (
    <div className="admin-notice draft-notice" role="status">
      {status === 'restored' ? (
        <>
          <span>Your unsaved changes to the {subject} were restored. They are not saved yet.</span>
          <span className="draft-notice-actions">
            <button type="button" className="admin-btn admin-btn-xs" onClick={onDiscard}>
              Discard changes
            </button>
            <button type="button" className="admin-btn admin-btn-xs" onClick={onDismiss}>
              OK
            </button>
          </span>
        </>
      ) : (
        <>
          <span>
            You have unsaved changes to the {subject} from earlier, but it was saved elsewhere
            since. Restoring them replaces that version when you save.
          </span>
          <span className="draft-notice-actions">
            <button type="button" className="admin-btn admin-btn-xs" onClick={onRestore}>
              Restore my changes
            </button>
            <button type="button" className="admin-btn admin-btn-xs" onClick={onDiscard}>
              Discard them
            </button>
          </span>
        </>
      )}
    </div>
  );
}
