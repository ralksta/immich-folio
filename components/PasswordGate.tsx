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
}

export default function PasswordGate({ slug, title }: PasswordGateProps) {
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
        body: JSON.stringify({ slug, password }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        setError('Wrong password');
        setPassword('');
      }
    } catch {
      setError('Something went wrong');
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            aria-label="Enter password"
            className={styles.input}
            autoFocus
            required
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Verifying…' : 'Enter'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
