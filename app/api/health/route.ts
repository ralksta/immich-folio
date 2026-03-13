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

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown';
  const { success } = checkRateLimit(`health:${ip}`, 60);

  if (!success) {
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
