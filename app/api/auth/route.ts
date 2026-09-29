/**
 * Auth API — validates passwords and sets auth cookies.
 * POST /api/auth { slug, password, type }
 *
 * `type: 'site'` unlocks the whole site; its `slug` is the fixed
 * SITE_AUTH_KEY, since there is only ever one site-wide gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate, isHttpsRequest, type ProtectedType } from '@/lib/auth';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

/** Tight limit for auth attempts — 10 per minute per IP. */
const AUTH_RPM = 10;

export async function POST(request: NextRequest) {
  // ── Rate limiting (brute-force protection) ──────────
  const ip = getClientIp(request);
  const { success, remaining, resetAt } = checkRateLimit(`auth:${ip}`, AUTH_RPM);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many attempts, try again later' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds(resetAt)),
          'X-RateLimit-Limit': String(AUTH_RPM),
          'X-RateLimit-Remaining': String(remaining),
        },
      },
    );
  }

  try {
    const body = await request.json();
    const { slug, password, type = 'subpage' } = body;

    if (!slug || !password) {
      return NextResponse.json({ error: 'Missing slug or password' }, { status: 400 });
    }

    // 🛡️ SECURITY: Validate input types and limit length to prevent DoS attacks
    if (typeof slug !== 'string' || slug.length > 100) {
      return NextResponse.json({ error: 'Invalid slug format or length' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length > 100) {
      return NextResponse.json({ error: 'Invalid password format or length' }, { status: 400 });
    }

    const TYPES: ProtectedType[] = ['subpage', 'album', 'journal', 'page', 'site'];
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // A key with no password (or none at all) answers exactly like a wrong
    // password: `authenticate()` returns null for both. A distinct "not
    // password-protected" reply told anyone probing slugs which ones hold a
    // locked entry — including drafts and offline subpages, whose pages answer
    // 404 and so give nothing away themselves.
    const setCookie = await authenticate(slug, password, type, isHttpsRequest(request));
    if (!setCookie) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': setCookie } });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
