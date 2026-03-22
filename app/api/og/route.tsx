/**
 * Dynamic OG image generator — renders social share previews.
 * Uses next/og (ImageResponse) to create 1200×630 cards.
 * Reads accent color from theme config.
 *
 * GET /api/og?title=Album+Name&subtitle=12+photos
 */

import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const config = getConfig();
  const { success, remaining, resetAt } = checkRateLimit(`og:${ip}`, config.rateLimitRpm);

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  const { searchParams } = request.nextUrl;
  const title = (searchParams.get('title') || 'Gallery').slice(0, 200);
  const subtitle = (searchParams.get('subtitle') || '').slice(0, 100);
  const { theme } = config;

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

      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            fontSize: '24px',
            color: '#999999',
            fontWeight: 300,
            marginTop: '16px',
            letterSpacing: '0.08em',
            textTransform: 'lowercase',
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
        'X-RateLimit-Remaining': String(remaining),
      },
    },
  );
}
