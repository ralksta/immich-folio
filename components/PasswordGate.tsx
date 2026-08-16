'use client';

/**
 * Password gate — shown when accessing a protected album/subpage.
 * Submits to /api/auth and refreshes on success.
 */

import { useState } from 'react';
import styles from './PasswordGate.module.css';
import { useDictionary } from './I18nProvider';

interface PasswordGateProps {
  slug: string;
  title: string;
  type?: 'subpage' | 'album' | 'journal' | 'site';
}

export default function PasswordGate({ slug, title, type = 'subpage' }: PasswordGateProps) {
  const t = useDictionary();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password, type }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        setError(t.password.incorrect);
        setPassword('');
      }
    } catch {
      setError(t.password.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>
          {type === 'site' ? t.password.siteSubtitle : t.password.subtitle}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            id="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password.placeholder}
            aria-label={t.password.placeholder}
            className={styles.input}
            autoFocus
            required
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? 'password-error' : undefined}
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? (
              <>
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.spinner}
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                  <path d="M12 2a10 10 0 0 1 10 10"></path>
                </svg>
                {t.password.verifying}
              </>
            ) : (
              t.password.submit
            )}
          </button>
        </form>

        {error && (
          <p id="password-error" className={styles.error} role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
