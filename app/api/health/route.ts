/**
 * Health check endpoint — reports app and Immich connectivity status.
 * Used by Docker HEALTHCHECK, monitoring tools, and load balancers.
 *
 * GET /api/health → { status, immich, uptime }
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich } from '@/lib/immich';
import { checkRateLimit } from '@/lib/rate-limit';

const startTime = Date.now();

// 60 RPM allows 1 check per second per IP, which is plenty for monitoring tools
// while preventing abuse that could overwhelm the Immich API via ping().
const HEALTH_RPM = 60;

export async function GET(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────
  // Security: Prioritize x-real-ip over x-forwarded-for
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown';
  const { success, resetAt } = checkRateLimit(`health:${ip}`, HEALTH_RPM);

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    console.warn(`[Health API] ⚠️ Rate limit exceeded for IP: ${ip}. Retry after ${retryAfter}s`);
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const immichOk = await immich.ping();

  const body = {
    status: immichOk ? 'ok' : 'degraded',
    immich: immichOk ? 'connected' : 'unreachable',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return NextResponse.json(body, {
    status: immichOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
