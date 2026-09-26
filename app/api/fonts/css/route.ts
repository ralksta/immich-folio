import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { getGoogleCss, parseFamilies, rewriteCss } from '@/lib/fonts';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

/**
 * The theme's font stylesheet, fetched from Google by the server and served
 * from this origin (lib/fonts.ts).
 *
 * Not behind the site password: the password gate itself is set in the
 * theme's fonts, and a stylesheet naming three public fonts gives nothing away.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { success, resetAt } = checkRateLimit(`fonts:${ip}`, getConfig().rateLimitRpm);
  if (!success) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds(resetAt)), 'Cache-Control': 'no-store' },
    });
  }

  const families = parseFamilies(request.nextUrl.searchParams.getAll('family'));
  if (!families) {
    return new NextResponse('/* invalid font families */', {
      status: 400,
      headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const css = await getGoogleCss(families);
  if (css === null) {
    // The theme CSS names a system fallback after every family, so an empty
    // stylesheet degrades to those. A short max-age lets the page pick the
    // fonts up once Google answers again.
    return new NextResponse('/* fonts unavailable, using system fallbacks */', {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  return new NextResponse(rewriteCss(css), {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
