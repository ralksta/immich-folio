import { describe, it, expect } from 'vitest';
import { isAdminPath } from '@/lib/admin/paths';

// The root layout must keep /admin reachable while the app is in setup mode
// (missing gallery.yaml or Immich credentials) — the admin panel is the tool
// that fixes exactly that state (#326).
describe('isAdminPath', () => {
  it('matches /admin exactly', () => {
    expect(isAdminPath('/admin')).toBe(true);
  });

  it('matches nested admin paths', () => {
    expect(isAdminPath('/admin/settings')).toBe(true);
  });

  it('does not match the homepage', () => {
    expect(isAdminPath('/')).toBe(false);
  });

  it('does not match sibling paths that merely start with "admin"', () => {
    expect(isAdminPath('/administration')).toBe(false);
  });

  it('treats a missing pathname header as non-admin', () => {
    expect(isAdminPath(null)).toBe(false);
  });
});
