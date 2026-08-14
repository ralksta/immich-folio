'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronDown } from './Icons';

/**
 * A single choice in a {@link Listbox}.
 *
 * `label` stays plain text so the same option table can feed a `title`
 * attribute or an aria-label; `icon` is the themed glyph shown beside it.
 */
export interface ListboxOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface ListboxProps<T extends string> {
  value: T;
  options: readonly ListboxOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name. Prefer `labelledBy` when a visible <label> exists. */
  ariaLabel?: string;
  /** id of the visible label element. */
  labelledBy?: string;
  disabled?: boolean;
  className?: string;
  /** Width of the trigger; the popup always matches it. */
  style?: React.CSSProperties;
}

/** How long a type-ahead buffer keeps collecting characters. */
const TYPEAHEAD_RESET_MS = 600;

/** Gap between the trigger and the popup. */
const POPUP_GAP = 4;
/** Space kept clear of the viewport edge. */
const VIEWPORT_MARGIN = 8;
/** Tallest the popup ever gets; beyond this it scrolls internally. */
const POPUP_MAX_HEIGHT = 260;
/** Below this the flipped side is not worth using. */
const POPUP_MIN_HEIGHT = 96;

/** Viewport coordinates for the popup, measured from the trigger. */
interface Placement {
  left: number;
  width: number;
  /** Set when the popup hangs below the trigger. */
  top?: number;
  /** Set when the popup is flipped above it. */
  bottom?: number;
  maxHeight: number;
}

/**
 * A select replacement that can show markup in its options.
 *
 * The native `<option>` element strips markup, so the admin panel's
 * `currentColor` SVG set cannot be used inside a real `<select>`. This
 * implements the ARIA combobox/listbox pattern instead: DOM focus never leaves
 * the trigger button, and the active option is announced through
 * `aria-activedescendant`. Options are plain `<li>`s — not focusable — which
 * keeps focus management to a single element.
 *
 * The popup is portalled to `document.body` and positioned from the trigger's
 * viewport rect. An absolutely positioned popup is clipped by any ancestor with
 * a non-visible overflow — and z-index cannot rescue it, because clipping
 * happens before stacking — so inside a scrolling modal the list would be cut
 * off. Escaping to the body also lets it flip above the trigger when there is
 * more room there.
 */
export function Listbox<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  labelledBy,
  disabled = false,
  className = '',
  style,
}: ListboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [activeIndex, setActiveIndex] = React.useState(selectedIndex);
  const [placement, setPlacement] = React.useState<Placement | null>(null);

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const typeahead = React.useRef({ buffer: '', at: 0 });

  const baseId = React.useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const selected = options[selectedIndex];

  const openList = React.useCallback(
    (index = selectedIndex) => {
      if (disabled) return;
      setActiveIndex(index);
      setOpen(true);
    },
    [disabled, selectedIndex],
  );

  const close = React.useCallback(() => {
    setOpen(false);
    setPlacement(null);
    typeahead.current = { buffer: '', at: 0 };
  }, []);

  const commit = React.useCallback(
    (index: number) => {
      const option = options[index];
      if (option) onChange(option.value);
      close();
      // Focus never left the trigger, but a pointer selection can blur it.
      buttonRef.current?.focus();
    },
    [close, onChange, options],
  );

  // Dismiss on outside pointer press. pointerdown (not click) so a press that
  // starts outside closes the popup before it can retarget the click. The popup
  // is portalled, so it is not inside the wrapper — without the second test a
  // press on an option would count as "outside" and close before it commits.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !listRef.current?.contains(target)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Measure once the popup is in the DOM but before paint, so it never shows at
  // a stale position. Until then it renders hidden purely to be measurable.
  React.useLayoutEffect(() => {
    if (!open) return;
    const trigger = buttonRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;

    const rect = trigger.getBoundingClientRect();
    // scrollHeight ignores our own max-height, so this is the natural height.
    const wanted = Math.min(POPUP_MAX_HEIGHT, list.scrollHeight + 2);
    const below = window.innerHeight - rect.bottom - POPUP_GAP - VIEWPORT_MARGIN;
    const above = rect.top - POPUP_GAP - VIEWPORT_MARGIN;
    const flip = wanted > below && above > below;
    const room = flip ? above : below;

    setPlacement({
      left: rect.left,
      width: rect.width,
      top: flip ? undefined : rect.bottom + POPUP_GAP,
      bottom: flip ? window.innerHeight - rect.top + POPUP_GAP : undefined,
      maxHeight: Math.max(POPUP_MIN_HEIGHT, Math.min(POPUP_MAX_HEIGHT, room)),
    });
  }, [open]);

  // The popup is anchored in viewport coordinates, so anything that moves the
  // trigger invalidates it. Dismiss rather than re-measure — that is what a
  // native select does, and the measurement above only runs on open. Capture
  // phase, because the scroll usually happens on an ancestor container.
  React.useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  // Keep the active option visible while arrowing or typing through a long list.
  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
      ?.scrollIntoView({ block: 'nearest' });
    // optionId is derived from baseId, which is stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, baseId]);

  /** Jump to the next option whose label starts with the accumulated buffer. */
  const runTypeahead = (char: string) => {
    const now = Date.now();
    const buffer =
      now - typeahead.current.at > TYPEAHEAD_RESET_MS ? char : typeahead.current.buffer + char;
    typeahead.current = { buffer, at: now };

    // A repeated single character cycles through matches instead of sticking.
    const repeat = buffer.length > 1 && buffer.split('').every((c) => c === buffer[0]);
    const needle = repeat ? buffer[0] : buffer;
    const from = repeat || buffer.length === 1 ? activeIndex + 1 : activeIndex;

    for (let i = 0; i < options.length; i++) {
      const index = (from + i) % options.length;
      if (options[index].label.toLowerCase().startsWith(needle.toLowerCase())) {
        setActiveIndex(index);
        return index;
      }
    }
    return null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const last = options.length - 1;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (!open) {
          openList(Math.min(last, Math.max(0, selectedIndex + step)));
        } else {
          setActiveIndex((i) => Math.min(last, Math.max(0, i + step)));
        }
        return;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : last;
        if (open) setActiveIndex(index);
        else openList(index);
        return;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) commit(activeIndex);
        else openList();
        return;
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        return;
      case 'Tab':
        // Let focus move on, but commit what the user was looking at.
        if (open) commit(activeIndex);
        return;
      default:
        break;
    }

    // Type-ahead: a single printable character, no modifiers.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        const match = runTypeahead(event.key);
        if (match === null) setActiveIndex(selectedIndex);
        return;
      }
      runTypeahead(event.key);
    }
  };

  return (
    <div ref={wrapperRef} className={`admin-listbox ${className}`.trim()} style={style}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        disabled={disabled}
        className="admin-listbox-trigger"
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="admin-listbox-value">
          {selected?.icon}
          <span>{selected?.label ?? ''}</span>
        </span>
        <IconChevronDown size={14} className="svg-icon admin-listbox-caret" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="admin-listbox-popup"
            tabIndex={-1}
            style={
              placement
                ? {
                    left: placement.left,
                    width: placement.width,
                    top: placement.top,
                    bottom: placement.bottom,
                    maxHeight: placement.maxHeight,
                  }
                : // First pass: laid out but invisible, only so it can be measured.
                  { left: 0, top: 0, visibility: 'hidden' }
            }
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                className={`admin-listbox-option${index === activeIndex ? ' is-active' : ''}${
                  option.value === value ? ' is-selected' : ''
                }`}
                // pointerdown would fire before the outside-press handler can run;
                // click is enough because that handler treats the popup as inside.
                onClick={() => commit(index)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {option.icon}
                <span className="admin-listbox-option-label">{option.label}</span>
                {option.value === value && (
                  <IconCheck
                    size={14}
                    className="svg-icon admin-listbox-check"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
