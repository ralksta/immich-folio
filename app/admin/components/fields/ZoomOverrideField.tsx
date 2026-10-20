'use client';

import type { ReactNode } from 'react';
import { useAdminDictionary } from '../AdminI18n';

/**
 * Lightbox zoom for one page or album (#467): inherit, on, or off.
 *
 * Three states rather than a switch, because `zoom: false` is a setting of its
 * own — it switches zoom off here while the site (or the page) has it on —
 * and a switch can only say true or absent. A select, like the layout
 * override beside it, with inheriting as the empty value, so the YAML keeps no
 * key until someone picks one.
 */
export default function ZoomOverrideField({
  id,
  value,
  onChange,
  inheritLabel,
  hint,
}: {
  id: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  inheritLabel: string;
  hint: ReactNode;
}) {
  const t = useAdminDictionary().settings.fields;
  const current = value === true ? 'on' : value === false ? 'off' : '';
  return (
    <div className="admin-field">
      <label htmlFor={id}>{t.zoom}</label>
      <select
        id={id}
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next === 'on' ? true : next === 'off' ? false : undefined);
        }}
      >
        <option value="">{inheritLabel}</option>
        <option value="on">{t.zoomOn}</option>
        <option value="off">{t.zoomOff}</option>
      </select>
      <span className="admin-field-hint">{hint}</span>
    </div>
  );
}
