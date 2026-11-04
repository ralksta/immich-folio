'use client';

import { useAdminDictionary } from './AdminI18n';

/**
 * The outcome of the last save. Typed rather than read off the wording: the bar
 * used to call a message an error when it started with "Error", so a failure
 * worded any other way was shown as a success (#600).
 */
export type SaveStatus = { kind: 'success' | 'error'; message: string } | null;

interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  status: SaveStatus;
  onSave: () => void;
  label: string;
  /** Show the cache-bypassing preview link (page builder only). */
  showPreview?: boolean;
  /**
   * Throw the unsaved edits away and return to the server state. Optional: an
   * editor without it simply does not offer the way out.
   */
  onDiscard?: () => void;
}

/**
 * Floating save bar pinned to the bottom of the viewport.
 *
 * It only mounts while there is something to act on (unsaved changes, an
 * in-flight save, or a result message) so it never covers content otherwise.
 * The success message is cleared by the caller after a few seconds, which
 * makes the bar disappear on its own.
 */
export default function SaveBar({
  dirty,
  saving,
  status,
  onSave,
  label,
  showPreview = false,
  onDiscard,
}: SaveBarProps) {
  const t = useAdminDictionary().shell.saveBar;
  if (!dirty && !saving && !status) return null;

  return (
    <div className={`floating-save-bar ${dirty ? 'dirty' : ''}`} role="status">
      <div className="save-bar-left">
        {status ? (
          <span className={`save-message ${status.kind}`}>{status.message}</span>
        ) : (
          <span className="unsaved-badge">
            <span className="badge-pulse-dot" aria-hidden="true" />
            {t.unsaved}
          </span>
        )}
      </div>
      <div className="save-bar-right">
        {onDiscard && dirty && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={onDiscard}
            disabled={saving}
          >
            {t.discard}
          </button>
        )}
        {showPreview && (
          <a
            href="/?fresh=1"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-ghost admin-btn-preview"
            title={t.previewTitle}
          >
            {t.preview}
          </a>
        )}
        <button
          className="admin-btn admin-btn-primary"
          onClick={onSave}
          disabled={!dirty || saving}
          title="⌘S / Ctrl+S"
        >
          {saving ? t.saving : label}
        </button>
      </div>
    </div>
  );
}
