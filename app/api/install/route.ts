import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { completeInstall, isInstalled, normalizeApiBase, validateSetupToken } from '@/lib/install';
import { invalidateConfigCache } from '@/lib/config';
import { DEFAULT_PRESET } from '@/lib/config/theme';
import { immich } from '@/lib/immich';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

/** Install submissions per minute per IP — only live before install. */
const INSTALL_RPM = 10;

const THEME_PRESETS = [
  'studio-modern',
  'studio',
  'minimal',
  'editorial',
  'classic',
  'noir',
  'monograph',
];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST: run the install wizard's final step — verify, then write config. */
export async function POST(request: NextRequest) {
  if (isInstalled()) {
    return NextResponse.json({ error: 'Setup is already complete' }, { status: 403 });
  }

  const token = request.nextUrl.searchParams.get('token') ?? request.headers.get('x-setup-token');
  if (!validateSetupToken(token)) {
    return NextResponse.json({ error: 'Invalid or missing setup token' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`install:${ip}`, INSTALL_RPM);
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
  if (!body) {
    return NextResponse.json({ error: 'Missing request body' }, { status: 400 });
  }

  const apiUrl = typeof body.apiUrl === 'string' ? body.apiUrl.trim() : '';
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: 'Immich URL and API key are required' }, { status: 400 });
  }

  const apiBase = normalizeApiBase(apiUrl);
  if (!apiBase) {
    return NextResponse.json({ error: 'Invalid Immich URL' }, { status: 400 });
  }

  const theme = THEME_PRESETS.includes(body.theme) ? body.theme : DEFAULT_PRESET;

  // Album selection is optional: an empty gallery is a valid install.
  const rawAlbums: unknown[] = Array.isArray(body.albums) ? (body.albums as unknown[]) : [];
  const albums: string[] = rawAlbums
    .filter((id): id is string => typeof id === 'string' && UUID_REGEX.test(id.trim()))
    .map((id) => id.trim());

  let adminPassword = '';
  if (typeof body.adminPassword === 'string' && body.adminPassword.length > 0) {
    adminPassword = body.adminPassword;
    if (adminPassword.length > 1024) {
      return NextResponse.json({ error: 'Admin password is too long' }, { status: 400 });
    }
  }

  // Verify the credentials against Immich before writing anything, so a typo
  // does not produce an "installed" app that cannot load a single photo.
  try {
    const res = await fetch(`${apiBase}/server/ping`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Immich rejected the connection (HTTP ${res.status})` },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Could not reach Immich at this URL' }, { status: 502 });
  }

  try {
    await completeInstall({
      apiUrl,
      apiKey,
      siteTitle: typeof body.siteTitle === 'string' ? body.siteTitle : undefined,
      siteSubtitle: typeof body.siteSubtitle === 'string' ? body.siteSubtitle : undefined,
      theme,
      albums,
      adminPassword,
    });

    // The wizard wrote new YAML; the running process must not keep serving
    // setup mode. The install.json mtime cache is dropped inside completeInstall.
    invalidateConfigCache();
    immich.invalidateAll();
    revalidatePath('/', 'layout');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Install] Failed to write configuration files:', err);
    return NextResponse.json({ error: 'Failed to write configuration files' }, { status: 500 });
  }
}
