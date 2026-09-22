// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SESSION_EXPIRED_EVENT, reportIfSessionExpired } from '../sessionExpiry';

/**
 * Sessions last 24 hours, but nothing re-checked authentication after the
 * mount-time check in AdminShell — every admin action after that just failed
 * quietly with the UI still looking signed in (#596). This is the one place
 * every admin fetch call site is meant to route a non-ok response through.
 */
describe('reportIfSessionExpired', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches the event and returns true for a 401', () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    const result = reportIfSessionExpired(new Response(null, { status: 401 }));

    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it('does nothing and returns false for other statuses', () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    for (const status of [200, 400, 403, 404, 500]) {
      expect(reportIfSessionExpired(new Response(null, { status }))).toBe(false);
    }

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});
