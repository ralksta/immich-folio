'use client';

import type { ReactNode } from 'react';

/**
 * A switch rendered as a card — the panel's top-level on/off control.
 *
 * The markup used to be written out at every call site: fourteen copies of the
 * same eighteen lines, differing only in the label and which setting they read
 * (#533). Changing how a switch looked meant editing it fourteen times, and the
 * copies had already drifted apart in their line wrapping. The class names are
 * unchanged, so `admin.css` styles this exactly as it styled the copies.
 *
 * `SettingRow` is the lighter sibling for switches *inside* a group panel; this
 * is the card that sits at the top level of a section.
 */
export default function ToggleCard({
  icon,
  title,
  description,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`admin-toggle-card ${checked ? 'active' : ''}`}
      onClick={onToggle}
      aria-pressed={checked}
    >
      <div className="toggle-card-info">
        <span className="toggle-card-title">
          {icon} {title}
        </span>
        <span className="toggle-card-desc">{description}</span>
      </div>
      <div className={`switch-toggle ${checked ? 'on' : ''}`}>
        <span className="switch-slider" />
      </div>
    </button>
  );
}
