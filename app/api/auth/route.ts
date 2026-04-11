/**
 * Auth API — validates album passwords and sets auth cookies.
 * POST /api/auth { slug, password }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate, isProtected } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

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
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
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

    if (type !== 'subpage' && type !== 'album') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (!isProtected(slug, type)) {
      return NextResponse.json(
        {
          error: `${type === 'subpage' ? 'Subpage' : 'Album'} is not password-protected`,
        },
        { status: 400 },
      );
    }

    const setCookie = authenticate(slug, password, type);
    if (!setCookie) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': setCookie } });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
