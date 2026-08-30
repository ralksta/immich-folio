'use client';

import type { CSSProperties, ReactNode } from 'react';

export type CardOption = { value: string; label: string; desc: string };

/**
 * Builds the option list for a picker from its value list and a label map, so
 * the values a setting accepts and the words shown for them stay one thing.
 */
export function toOptions(
  values: readonly string[],
  info: Record<string, { label: string; desc: string }>,
): CardOption[] {
  return values.map((value) => ({
    value,
    label: info[value]?.label ?? value,
    desc: info[value]?.desc ?? '',
  }));
}

/**
 * A labelled grid of picker cards — theme preset, layout, frame, hero style,
 * aspect ratio.
 *
 * All five were written out separately: each had its own `.map()`, its own
 * `preset-card` button, its own `active` handling, and its label text buried in
 * an object literal a thousand lines from the value list it described (#533).
 * The differences between them are the preview drawn on the card and, for the
 * theme preset, a few custom properties — so those are the props, and the rest
 * is stated once.
 *
 * The class names are unchanged, so `admin.css` styles these exactly as it
 * styled the copies.
 */
export default function OptionGrid({
  label,
  options,
  value,
  onSelect,
  cardClassName,
  renderPreview,
  renderSpecs,
  cardStyle,
}: {
  label: string;
  options: CardOption[];
  /** The resolved value — the caller applies its own default before passing it. */
  value: string;
  onSelect: (value: string) => void;
  /** Second class on the card, e.g. `frame-card`; `preset-card` is always set. */
  cardClassName: string;
  renderPreview?: (option: CardOption) => ReactNode;
  /** Extra line under the description, used by the theme preset for its specs. */
  renderSpecs?: (option: CardOption) => ReactNode;
  cardStyle?: (option: CardOption) => CSSProperties | undefined;
}) {
  return (
    <div className="admin-field">
      <label>{label}</label>
      <div className="preset-card-grid">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`preset-card ${cardClassName} ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(option.value)}
              style={cardStyle?.(option)}
              aria-pressed={isActive}
            >
              {renderPreview?.(option)}
              <div className="preset-card-info">
                <span className="preset-card-name">{option.label}</span>
                <span className="preset-card-desc">{option.desc}</span>
                {renderSpecs?.(option)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
