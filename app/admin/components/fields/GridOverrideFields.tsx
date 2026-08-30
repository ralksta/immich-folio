'use client';

import type { ReactNode } from 'react';

type GridOverride = { columns?: number; gap?: number };

const NUMBER_INPUT_STYLE = {
  padding: '8px 12px',
  borderRadius: '6px',
  flex: 1,
  fontSize: '0.9rem',
} as const;

/**
 * The override editor for one grid: a column count and a gap, both optional,
 * both falling back to a wider setting when left empty.
 *
 * Giving the album covers their own grid (#523) was implemented by copying this
 * block — fifty-eight lines whose entire diff was the bounds it clamps to and
 * the key it writes (#533). Two editors that have to behave identically had two
 * implementations, which is how they drift apart.
 *
 * A value outside the bounds is discarded rather than clamped, which is what
 * the copies did: the field then reads as empty and the setting falls back,
 * instead of silently saving a number nobody typed.
 */
export default function GridOverrideFields({
  label,
  hint,
  columnsMin,
  columnsMax,
  gapMax,
  value,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  columnsMin: number;
  columnsMax: number;
  gapMax: number;
  value: GridOverride | undefined;
  /** Receives the whole next override; the caller normalises and stores it. */
  onChange: (next: GridOverride) => void;
}) {
  const patch = (key: 'columns' | 'gap', raw: string, min: number, max: number) => {
    const n = raw === '' ? undefined : Number(raw);
    onChange({
      ...(value || {}),
      [key]: n != null && n >= min && n <= max ? n : undefined,
    });
  };

  return (
    <div className="admin-field" style={{ marginTop: '1rem' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '12px' }}>
        <input
          type="number"
          min={columnsMin}
          max={columnsMax}
          value={value?.columns ?? ''}
          placeholder="Columns (site default)"
          onChange={(e) => patch('columns', e.target.value, columnsMin, columnsMax)}
          style={NUMBER_INPUT_STYLE}
        />
        <input
          type="number"
          min={0}
          max={gapMax}
          value={value?.gap ?? ''}
          placeholder="Gap in px (theme default)"
          onChange={(e) => patch('gap', e.target.value, 0, gapMax)}
          style={NUMBER_INPUT_STYLE}
        />
      </div>
      <p className="admin-field-hint">{hint}</p>
    </div>
  );
}
