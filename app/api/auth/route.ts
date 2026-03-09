/**
 * Auth API — validates album passwords and sets auth cookies.
 * POST /api/auth { slug, password }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate, isProtected } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

/** Tight limit for auth attempts — 10 per minute per IP. */
const AUTH_RPM = 10;

export async function POST(request: NextRequest) {
  // ── Rate limiting (brute-force protection) ──────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const { success } = checkRateLimit(`auth:${ip}`, AUTH_RPM);

  if (!success) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { slug, password } = body;

    if (!slug || !password) {
      return NextResponse.json({ error: 'Missing slug or password' }, { status: 400 });
    }

    // 🛡️ SECURITY: Validate input types and limit length to prevent DoS attacks
    // (e.g. from extremely long strings being passed to expensive crypto functions)
    if (typeof slug !== 'string' || slug.length > 100) {
      return NextResponse.json({ error: 'Invalid slug format or length' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length > 100) {
      return NextResponse.json({ error: 'Invalid password format or length' }, { status: 400 });
    }

    if (!isProtected(slug)) {
      return NextResponse.json({ error: 'Album is not password-protected' }, { status: 400 });
    }

    const setCookie = authenticate(slug, password);
    if (!setCookie) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': setCookie } });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
