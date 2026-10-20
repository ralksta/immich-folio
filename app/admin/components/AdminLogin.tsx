'use client';

import { useState } from 'react';
import { useAdminDictionary } from './AdminI18n';

interface Props {
  onSuccess: () => void;
  /** Shown above the form, e.g. "Your session expired. Sign in again." (#596) */
  notice?: string;
}

export default function AdminLogin({ onSuccess, notice }: Props) {
  const t = useAdminDictionary().shell.login;
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || t.failed);
      }
    } catch {
      setError(t.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-header">
          <h1>Immich Folio</h1>
          <p>{t.subtitle}</p>
        </div>

        {notice && <div className="admin-notice">{notice}</div>}

        <div className="admin-field">
          <label htmlFor="admin-password">{t.password}</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.passwordPlaceholder}
            autoFocus
            disabled={loading}
          />
        </div>

        {error && <div className="admin-error">{error}</div>}

        <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
          {loading ? t.signingIn : t.signIn}
        </button>
      </form>
    </div>
  );
}
