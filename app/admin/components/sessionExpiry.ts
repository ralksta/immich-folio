/**
 * Fired on `window` by an admin action whose request came back 401 — the
 * session cookie expired (sessions last 24 hours) or was cleared elsewhere.
 * AdminShell listens and drops back to the login screen with an explanation,
 * instead of each save/reload path failing quietly while the UI still looks
 * signed in (#596).
 *
 * Same pattern as DOCTOR_LEVEL_EVENT in systemHealth.ts: a window event
 * rather than a prop or context, because the components that need to raise
 * this (PageBuilder, SettingsEditor, JournalStudio, AdminDashboard) sit
 * several routes below AdminShell, which owns the auth gate.
 */
export const SESSION_EXPIRED_EVENT = 'folio:admin-session-expired';

/**
 * Call with the Response from an admin fetch. If it is a 401, dispatches the
 * event and returns true, so the caller can skip its own generic error
 * handling for that response and let AdminShell take over instead.
 */
export function reportIfSessionExpired(res: Response): boolean {
  if (res.status !== 401) return false;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  return true;
}
