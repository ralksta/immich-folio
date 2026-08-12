'use client';

interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  saveMessage: string;
  onSave: () => void;
  label: string;
  /** Show the cache-bypassing preview link (page builder only). */
  showPreview?: boolean;
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
  saveMessage,
  onSave,
  label,
  showPreview = false,
}: SaveBarProps) {
  if (!dirty && !saving && !saveMessage) return null;

  return (
    <div className={`floating-save-bar ${dirty ? 'dirty' : ''}`} role="status">
      <div className="save-bar-left">
        {saveMessage ? (
          <span className={`save-message ${saveMessage.startsWith('Error') ? 'error' : 'success'}`}>
            {saveMessage}
          </span>
        ) : (
          <span className="unsaved-badge">
            <span className="badge-pulse-dot" aria-hidden="true" />
            Unsaved changes
          </span>
        )}
      </div>
      <div className="save-bar-right">
        {showPreview && (
          <a
            href="/?fresh=1"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-ghost admin-btn-preview"
            title="Open site in new tab (bypassing cache)"
          >
            ↗ Preview Site
          </a>
        )}
        <button
          className="admin-btn admin-btn-primary"
          onClick={onSave}
          disabled={!dirty || saving}
          title="⌘S / Ctrl+S"
        >
          {saving ? 'Saving...' : label}
        </button>
      </div>
    </div>
  );
}
