import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isSiteUnlocked } from '@/lib/auth';
import { isAdminPath } from '@/lib/admin/paths';
import { isInstallPath } from '@/lib/install';

/** Where a locked-out visitor is rewritten to. */
const GATE_PATH = '/gate';

/**
 * Site-wide password gate.
 *
 * This has to happen here rather than in the root layout. A layout that swaps
 * `children` for a password form still lets the page render — the RSC payload
 * for the requested route is produced either way, and album names and asset
 * tokens travel with it. Rewriting means the protected page is never rendered
 * at all.
 *
 * Route handlers are outside the matcher and carry their own check; see
 * `siteLockResponse` in `lib/auth.ts`.
 */
function siteGate(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // /admin owns its own password and is where the site password is set;
  // /install is the wizard a fresh deployment needs before it can have a
  // password at all. Locking either would be locking out the operator.
  if (isAdminPath(pathname) || isInstallPath(pathname) || pathname === GATE_PATH) return null;

  if (isSiteUnlocked((name) => request.cookies.get(name)?.value)) return null;

  // Rewrite, not redirect: the URL the visitor asked for stays in the address
  // bar, so unlocking lands them where they were going.
  return NextResponse.rewrite(new URL(GATE_PATH, request.url));
}

export function proxy(request: NextRequest) {
  /*
   * Runs before the prefetch shortcut below, and must keep doing so: a
   * prefetch asks for the same RSC payload as a normal navigation, so a gate
   * that skipped them could be walked straight past with one request header.
   */
  const gated = siteGate(request);
  if (gated) return gated;

  /*
   * Prefetches used to be excluded by the matcher itself. They are filtered
   * here instead, because the matcher is now also what makes the gate above
   * run — and a matcher that skips prefetches would skip the gate with them.
   * The effect on the CSP is unchanged: a prefetch gets no nonce and no
   * policy header, exactly as before.
   */
  if (
    request.headers.get('next-router-prefetch') !== null ||
    request.headers.get('purpose') === 'prefetch'
  ) {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isDev = process.env.NODE_ENV === 'development';

  // Define CSP directives
  const cspDirectives = [
    "default-src 'self'",
    // No 'unsafe-inline' fallback: CSP3 browsers ignore it next to a nonce, but
    // CSP2-only browsers ignore 'strict-dynamic' and would honour it — making
    // the fallback strictly worse than having none. There are no inline
    // <script> tags in the app; Next.js nonces the ones it injects itself.
    // In development mode, Next.js / React dev tools require 'unsafe-eval' for Fast Refresh
    // and stack trace reconstruction. Omitted in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://unpkg.com",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Layouts cannot read the request URL; the root layout needs the pathname
  // to keep /admin reachable while the app is in setup mode.
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('Content-Security-Policy', cspDirectives);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Only the CSP is set here. Every other security header comes from
  // next.config.ts, which also covers /api and static assets. Setting a header
  // in both places emits it twice with conflicting values.
  response.headers.set('Content-Security-Policy', cspDirectives);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes — JSON/binary responses, no document CSP needed;
     *   the public ones enforce the site gate themselves)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     *
     * /admin is NOT excluded: it is the highest-privilege surface in the app
     * and previously ran with no enforced CSP at all.
     *
     * Prefetches are no longer excluded here — see the note in proxy().
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
