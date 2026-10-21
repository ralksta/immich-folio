import { NextRequest, NextResponse } from 'next/server';
import { isInstalled, normalizeApiBase, validateSetupToken } from '@/lib/install';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

/** Album discovery attempts per minute per IP — only live before install. */
const INSTALL_ALBUMS_RPM = 30;

interface AlbumSummary {
  id: string;
  albumName: string;
  description: string;
  assetCount: number;
}

/**
 * POST: list shared Immich albums for the wizard's picker, using the
 * credentials the user just typed. The configured Immich client cannot be used
 * here — it reads getConfig(), which is still in setup mode.
 */
export async function POST(request: NextRequest) {
  if (isInstalled()) {
    return NextResponse.json({ error: 'Setup is already complete' }, { status: 403 });
  }

  const token = request.nextUrl.searchParams.get('token') ?? request.headers.get('x-setup-token');
  if (!validateSetupToken(token)) {
    return NextResponse.json({ error: 'Invalid or missing setup token' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`install-albums:${ip}`, INSTALL_ALBUMS_RPM);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds(rl.resetAt)) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const apiUrl = typeof body?.apiUrl === 'string' ? body.apiUrl.trim() : '';
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: 'Immich URL and API key are required' }, { status: 400 });
  }

  const apiBase = normalizeApiBase(apiUrl);
  if (!apiBase) {
    return NextResponse.json({ error: 'Invalid Immich URL' }, { status: 400 });
  }

  try {
    const res = await fetch(`${apiBase}/albums?shared=true`, {
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Immich returned HTTP ${res.status} — check the URL and API key` },
        { status: 502 },
      );
    }

    const contentType = res.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Immich returned a non-JSON response — is the URL a server base URL?' },
        { status: 502 },
      );
    }

    const albums = (await res.json()) as AlbumSummary[];
    return NextResponse.json({
      albums: albums.map((album) => ({
        id: album.id,
        albumName: album.albumName,
        assetCount: album.assetCount,
        description: album.description || '',
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach Immich at this URL' }, { status: 502 });
  }
}
