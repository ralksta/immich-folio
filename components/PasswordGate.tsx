'use client';

/**
 * Password gate — shown when accessing a protected album/subpage.
 * Submits to /api/auth and refreshes on success.
 */

import { useState } from 'react';
import styles from './PasswordGate.module.css';

interface PasswordGateProps {
  slug: string;
  title: string;
  type?: 'subpage' | 'album';
}

export default function PasswordGate({ slug, title, type = 'subpage' }: PasswordGateProps) {
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
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch {
      setError('Unable to verify password. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>This gallery is password-protected.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            id="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            aria-label="Enter password"
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
                Verifying…
              </>
            ) : (
              'Enter'
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
