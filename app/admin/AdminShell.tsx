'use client';

import { useState, useEffect, type ReactNode } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { SESSION_EXPIRED_EVENT } from './components/sessionExpiry';
import './admin.css';

/**
 * Auth gate and panel chrome for every /admin route. Lives in the admin layout
 * rather than in each page, so navigating between tabs keeps the session check
 * and the header mounted instead of re-running them per route.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
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
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="admin-disabled">
        <div className="admin-disabled-card">
          <h1>Admin Panel</h1>
          <p>
            The admin panel is not enabled. Set <code>ADMIN_PASSWORD</code> in your environment
            variables to activate it.
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AdminLogin
        notice={sessionExpired ? 'Your session expired. Sign in again.' : undefined}
        onSuccess={() => {
          setSessionExpired(false);
          setAuthenticated(true);
        }}
      />
    );
  }

  return <AdminDashboard onLogout={() => setAuthenticated(false)}>{children}</AdminDashboard>;
}
