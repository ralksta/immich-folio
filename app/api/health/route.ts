/**
 * Health check endpoint — reports app and Immich connectivity status.
 * Used by Docker HEALTHCHECK, monitoring tools, and load balancers.
 *
 * GET /api/health → { status, immich, uptime }
 */

import { NextResponse, NextRequest } from 'next/server';
import { immich } from '@/lib/immich';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getConfig } from '@/lib/config';

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { success, resetAt } = checkRateLimit(`health:${ip}`, getConfig().rateLimitRpm);

  if (!success) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
      },
    });
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
