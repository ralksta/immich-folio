/**
 * Whether a request pathname belongs to the admin panel.
 *
 * Used by the root layout to keep /admin reachable while the app is in
 * setup mode: the setup screen must not lock out the very tool that fixes
 * an incomplete configuration (#326). A null pathname (header missing,
 * e.g. a route not covered by the middleware matcher) counts as non-admin
 * so the setup screen remains the safe default.
 */
export function isAdminPath(pathname: string | null): boolean {
  return pathname === '/admin' || pathname?.startsWith('/admin/') === true;
}
