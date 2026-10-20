'use client';

import { IconLock } from '../Icons';
import { rich, useAdminDictionary } from '../AdminI18n';

/**
 * The note under a field an environment variable overrides (#605). The field
 * itself is rendered disabled by its section; this names the variable, so the
 * operator knows where the value actually lives. Never shows the value.
 */
export default function EnvLockNote({ id, variable }: { id?: string; variable: string }) {
  const t = useAdminDictionary().settings.fields;
  return (
    <p id={id} className="admin-env-lock">
      <span className="admin-env-lock-pill">
        <IconLock size={11} /> {t.locked}
      </span>
      <span>{rich(t.envLockNote, { variable: <code>{variable}</code> })}</span>
    </p>
  );
}
