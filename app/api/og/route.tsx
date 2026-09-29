/**
 * Dynamic OG image generator — renders social share previews.
 * Uses next/og (ImageResponse) to create 1200×630 cards.
 * Reads accent color from theme config.
 *
 * GET /api/og?title=Album+Name&subtitle=12+photos&sig=…
 *
 * Only text signed by `ogImageUrl()` (lib/ogImage.ts) is rendered; anything
 * else gets the plain site card, so the site cannot be made to print
 * arbitrary text under its own name.
 */

import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { siteLockResponse } from '@/lib/auth';
import { verifiedOgText } from '@/lib/ogImage';

/**
 * OG image rendering runs satori + resvg per request and each unique ?title
 * misses every cache tier, so this is far more expensive than an image proxy
 * hit. It must not inherit RATE_LIMIT_RPM (default 1500) — that turns the
 * endpoint into an unauthenticated CPU amplifier.
 */
const OG_RPM = 30;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { theme, siteTitle, authSecret } = getConfig();

  const { success, resetAt } = checkRateLimit(`og:${ip}`, OG_RPM);
  if (!success) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds(resetAt)),
        'Cache-Control': 'no-store',
      },
    });
  }

  // The page-level gate does not cover route handlers — without this a locked
  // site would still serve to anyone holding the URL.
  const locked = siteLockResponse(request);
  if (locked) return locked;

  // The site title is already in the visitor's language, or falls back to the
  // locale's own word for "Gallery" (lib/config). It is also the card for any
  // URL whose text the site did not sign itself.
  const signed = verifiedOgText(request.nextUrl.searchParams, authSecret);
  const title = signed?.title || siteTitle || '';
  const subtitle = signed?.subtitle ?? '';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '60px',
      }}
    >
      {/* Decorative top line */}
      <div
        style={{
          width: '60px',
          height: '2px',
          backgroundColor: theme.accent,
          marginBottom: '40px',
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: '64px',
          fontWeight: 600,
          color: '#f0f0f0',
          letterSpacing: '0.02em',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: '900px',
        }}
      >
        {title}
      </div>

      {/* Subtitle — printed as the locale spells it. A lowercase transform
          turned German "25 Fotos" into "25 fotos". */}
      {subtitle && (
        <div
          style={{
            fontSize: '24px',
            color: '#999999',
            fontWeight: 300,
            marginTop: '16px',
            letterSpacing: '0.08em',
          }}
        >
          {subtitle}
        </div>
      )}

      {/* Bottom decorative line */}
      <div
        style={{
          width: '60px',
          height: '2px',
          backgroundColor: theme.accent,
          marginTop: '40px',
        }}
      />
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    },
  );
}
