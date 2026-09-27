'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import * as Icons from '../Icons';
// Direct import from the theme module, not from '@/lib/config': the config
// index pulls in `fs` and cannot be bundled into a client component.
import { resolveTheme } from '@/lib/config/theme';
import type { SettingsYaml } from '@/lib/config/schema';
import type { Settings } from './types';

/**
 * One labelled block of related switches.
 *
 * The features panel was a single flat grid of identical cards, so nothing said
 * which switches belonged together — and a switch that publishes private notes
 * looked exactly like one that controls a fade (#510).
 */
export function FeatureGroup({
  icon,
  title,
  description,
  chip,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  /** Short marker for a group that needs its own weight, e.g. what visitors see. */
  chip?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-group">
      <div className="settings-group-head">
        <span className="settings-group-title">
          {icon}
          {title}
          {chip && <span className="settings-group-chip">{chip}</span>}
        </span>
        <span className="settings-group-desc">{description}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * A switch inside a group panel. Deliberately lighter than a toggle card: these
 * are settings *of* the panel they sit in, and rendering them as peers of the
 * top-level cards is what hid the structure in the first place.
 */
export function SettingRow({
  title,
  description,
  checked,
  onToggle,
  disabled,
  hint,
  indented,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  /** A row whose parent switch is off — shown, but inert and explained. */
  disabled?: boolean;
  hint?: string;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      className={`setting-row${indented ? ' setting-row--indented' : ''}${
        disabled ? ' setting-row--disabled' : ''
      }`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="setting-row-info">
        <span className="setting-row-title">{title}</span>
        <span className="setting-row-desc">{description}</span>
        {hint && (
          <span className="setting-row-hint">
            <Icons.IconBan size={11} /> {hint}
          </span>
        )}
      </span>
      <span className={`switch-toggle switch-toggle--sm ${checked && !disabled ? 'on' : ''}`}>
        <span className="switch-slider" />
      </span>
    </button>
  );
}

/**
 * One switch in a feature list: a single dense line instead of a card. Cards
 * gave every switch the same weight, so a fade and a whole page looked alike;
 * rows grouped by meaning let the group heading carry that weight instead.
 * The optional link sits beside the switch, not inside it — a link nested in
 * a button is invalid and swallows the click.
 */
export function FeatureRow({
  icon,
  title,
  description,
  checked,
  onToggle,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  /** Where this feature is configured beyond on/off. */
  href?: string;
}) {
  return (
    <div className="feature-row">
      <button type="button" className="feature-row-main" onClick={onToggle} aria-pressed={checked}>
        <span className="feature-row-icon">{icon}</span>
        <span className="feature-row-info">
          <span className="feature-row-title">{title}</span>
          <span className="feature-row-desc">{description}</span>
        </span>
        <span className={`switch-toggle ${checked ? 'on' : ''}`}>
          <span className="switch-slider" />
        </span>
      </button>
      {/* Reserved even without a link, so every switch lines up in one column. */}
      {href ? (
        <Link href={href} className="feature-row-link">
          Configure →
        </Link>
      ) : (
        <span className="feature-row-link" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * The theme as the site resolves it. A preset name the form does not know (a
 * hand-edited typo) falls back to the default instead of taking the panel down.
 */
export function effectiveTheme(raw: Settings['theme']) {
  try {
    return resolveTheme(raw as SettingsYaml['theme']);
  } catch {
    return resolveTheme(undefined);
  }
}
