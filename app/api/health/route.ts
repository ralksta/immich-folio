/**
 * Health check endpoint — reports app and Immich connectivity status.
 * Used by Docker HEALTHCHECK, monitoring tools, and load balancers.
 *
 * GET /api/health → { status, immich, uptime }
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich } from '@/lib/immich';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { getConfig } from '@/lib/config';

const startTime = Date.now();

// Cache the health check result for 10 seconds to prevent
// DoS attacks against the upstream Immich server while still
// allowing frequent polling from load balancers/orchestrators.
let cachedImmichOkPromise: Promise<boolean> | null = null;
let lastCheckTime = 0;
const CACHE_DURATION_MS = 10_000;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { rateLimitRpm } = getConfig();

  const { success, remaining, resetAt } = checkRateLimit(`health:${ip}`, rateLimitRpm);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds(resetAt)),
          'X-RateLimit-Limit': String(rateLimitRpm),
          'X-RateLimit-Remaining': String(remaining),
        },
      },
    );
  }

  const now = Date.now();
  if (!cachedImmichOkPromise || now - lastCheckTime > CACHE_DURATION_MS) {
    cachedImmichOkPromise = immich.ping();
    lastCheckTime = now;
  }

  // Await the potentially shared promise to prevent a thundering herd
  // of concurrent requests from hitting the upstream server on a cache miss.
  let immichOk = false;
  try {
    immichOk = await cachedImmichOkPromise;
  } catch {
    cachedImmichOkPromise = null; // reset on error so next request retries
    immichOk = false;
  }

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
