import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminPassword,
  createAdminToken,
  isAdminAuthenticated,
  isAdminEnabled,
  COOKIE_NAME,
  SESSION_DURATION_MS,
} from '@/lib/admin/auth';

/** POST: Login with admin password. */
export async function POST(request: NextRequest) {
  if (!isAdminEnabled()) {
    return NextResponse.json(
      { error: 'Admin panel is not enabled. Set ADMIN_PASSWORD in your environment.' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.password || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  if (!verifyAdminPassword(body.password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = createAdminToken();
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return response;
}

/** GET: Check session status. */
export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ authenticated: false, enabled: false });
  }

  const authenticated = await isAdminAuthenticated();
  return NextResponse.json({ authenticated, enabled: true });
}

/** DELETE: Logout. */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
