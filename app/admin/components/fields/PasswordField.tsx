'use client';

import { useId, useState } from 'react';
import { IconEye, IconEyeOff, IconLock } from '../Icons';

/**
 * One password input for every place the admin sets one: subpage, album,
 * journal entry and site password (#690).
 *
 * The save routes store passwords as scrypt hashes (lib/admin/passwordHashing.ts),
 * so a saved password comes back as `scrypt:…`. That value is never put into
 * the input: showing it would invite editing a hash, and saving an edited hash
 * would lock the page with the hash string. Instead the field reads
 * "Protected", with Change and Remove.
 *
 * A plaintext value from a hand-written file is shown in the input as before;
 * the next save stores it hashed.
 */
export default function PasswordField({
  value,
  onChange,
  placeholder = 'Leave empty for public access',
  disabled,
  label,
  id: idProp,
}: {
  value: string | undefined;
  /** `undefined` removes the password. */
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name when there is no visible <label> for the field. */
  label?: string;
  /** For a visible <label htmlFor>; generated otherwise. */
  id?: string;
}) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  /** The stored hash while it is being changed, so "Keep" can put it back. */
  const [original, setOriginal] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const isHash = !!value && value.startsWith('scrypt:');
  // Derived rather than stored: a save that brings back a new hash ends the
  // change without the field having to be told.
  const changing = original !== null && (value === original || !isHash);

  if (isHash && !changing) {
    return (
      <div className="password-field password-field--set">
        <span className="password-field__status">
          <IconLock size={12} /> Protected
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-ghost admin-btn-sm"
          // The hash stays in the form until something is typed, so opening
          // the field and saving is not a way to lose the password.
          onClick={() => setOriginal(value)}
          disabled={disabled}
        >
          Change
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-ghost admin-btn-sm"
          onClick={() => onChange(undefined)}
          disabled={disabled}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="password-field">
      <div className="password-input-wrapper">
        <span className="password-icon" aria-hidden="true">
          <IconLock size={12} />
        </span>
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={changing && value === original ? '' : (value ?? '')}
          // Emptying the field while changing falls back to the stored hash;
          // only Remove takes a password away.
          onChange={(e) => onChange(e.target.value || (changing ? original! : undefined))}
          placeholder={changing ? 'New password' : placeholder}
          aria-label={label}
          autoComplete="new-password"
          disabled={disabled}
          autoFocus={changing}
        />
        <button
          type="button"
          className="password-field__reveal"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          aria-controls={id}
          disabled={disabled}
        >
          {revealed ? <IconEyeOff size={14} /> : <IconEye size={14} />}
        </button>
      </div>
      {changing && (
        <button
          type="button"
          className="admin-btn admin-btn-ghost admin-btn-sm password-field__cancel"
          onClick={() => {
            onChange(original);
            setOriginal(null);
          }}
        >
          Keep current password
        </button>
      )}
    </div>
  );
}
