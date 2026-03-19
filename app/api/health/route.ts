/**
 * Health check endpoint — reports app and Immich connectivity status.
 * Used by Docker HEALTHCHECK, monitoring tools, and load balancers.
 *
 * GET /api/health → { status, immich, uptime }
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich } from '@/lib/immich';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const startTime = Date.now();

export async function GET(request: NextRequest) {
  // 🛡️ SECURITY: Protect health check from DoS attacks
  const ip = getClientIp(request);
  const { success } = checkRateLimit(`health:${ip}`, 60); // 60 requests per minute

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
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
