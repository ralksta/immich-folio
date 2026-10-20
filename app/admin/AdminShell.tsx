'use client';

import { useState, useEffect, type ReactNode } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { SESSION_EXPIRED_EVENT } from './components/sessionExpiry';
import { NotificationProvider } from './components/Notifications';
import './admin.css';
import { ConfirmProvider } from './components/ConfirmDialog';
import { rich, useAdminDictionary } from './components/AdminI18n';

/**
 * Auth gate and panel chrome for every /admin route. Lives in the admin layout
 * rather than in each page, so navigating between tabs keeps the session check
 * and the header mounted instead of re-running them per route.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const t = useAdminDictionary().shell.gate;
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(true);
  // Sessions last 24 hours (lib/admin/auth.ts), but nothing re-checked
  // authentication after the mount-time check below — leave a tab open
  // overnight and every admin request answered 401 while the UI still looked
  // signed in (#596). SESSION_EXPIRED_EVENT is raised by the fetch call sites
  // that noticed; this is what turns that into dropping back to the login
  // screen with an explanation instead of each of them failing quietly.
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth');
        const data = await res.json();
        setAuthenticated(data.authenticated);
        setEnabled(data.enabled);
      } catch {
        setAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    function onSessionExpired() {
      setAuthenticated(false);
      setSessionExpired(true);
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  if (authenticated === null) {
    return (
      <div className="admin-loading" role="status">
        <div className="admin-spinner" aria-hidden="true" />
        <span className="sr-only">{t.loading}</span>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="admin-disabled">
        <div className="admin-disabled-card">
          <h1>{t.disabledTitle}</h1>
          <p>{rich(t.disabledBody, { env: <code>ADMIN_PASSWORD</code> })}</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AdminLogin
        notice={sessionExpired ? t.sessionExpired : undefined}
        onSuccess={() => {
          setSessionExpired(false);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <NotificationProvider>
      <ConfirmProvider>
        <AdminDashboard onLogout={() => setAuthenticated(false)}>{children}</AdminDashboard>
      </ConfirmProvider>
    </NotificationProvider>
  );
}
