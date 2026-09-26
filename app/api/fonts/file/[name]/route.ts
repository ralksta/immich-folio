import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { getFontFile } from '@/lib/fonts';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

/**
 * One font file named by a stylesheet from /api/fonts/css (lib/fonts.ts).
 * The name is a hash of the gstatic URL, so a file never changes under it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const ip = getClientIp(request);
  const { success, resetAt } = checkRateLimit(`fonts:${ip}`, getConfig().rateLimitRpm);
  if (!success) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds(resetAt)), 'Cache-Control': 'no-store' },
    });
  }

  const data = await getFontFile((await params).name);
  if (!data) {
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  return new NextResponse(data as BodyInit, {
    headers: {
      'Content-Type': 'font/woff2',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
