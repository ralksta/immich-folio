import { IconLock } from '../Icons';

/**
 * The note under a field an environment variable overrides (#605). The field
 * itself is rendered disabled by its section; this names the variable, so the
 * operator knows where the value actually lives. Never shows the value.
 */
export default function EnvLockNote({ id, variable }: { id?: string; variable: string }) {
  return (
    <p id={id} className="admin-env-lock">
      <span className="admin-env-lock-pill">
        <IconLock size={11} /> Locked
      </span>
      <span>
        Set by <code>{variable}</code> in the environment. Change or unset it there; edits here
        would have no effect.
      </span>
    </p>
  );
}
