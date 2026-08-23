import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';
import { env } from '@/lib/env';
import { listJournalEntries } from '@/lib/admin/journal-service';
import {
  checkAlbumIds,
  checkAlbumsShared,
  checkAuthSecret,
  checkImmichCalls,
  checkPasswords,
  checkProxyHops,
  checkWritable,
  countForwardedHops,
  PROXY_MARKER_HEADERS,
  worstLevel,
  type AlbumRef,
  type DoctorFinding,
  type PasswordRef,
} from '@/lib/admin/doctor';

/**
 * Config doctor (#491). Gathers the evidence; lib/admin/doctor.ts judges it.
 *
 * Everything is best-effort: a check that cannot gather its input reports that
 * rather than failing the whole report, because a broken install is exactly
 * when this route needs to answer.
 */
export async function GET(request: NextRequest) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getConfig();
  const findings: DoctorFinding[] = [];

  // ── Secret and proxy: read off the environment and this very request ──
  findings.push(checkAuthSecret(env.AUTH_SECRET || config.authSecret));
  findings.push(
    checkProxyHops(
      config.trustedProxyHops,
      countForwardedHops(request.headers.get('x-forwarded-for')),
      PROXY_MARKER_HEADERS.some((h) => !!request.headers.get(h)),
    ),
  );

  // ── Immich: the three calls Folio actually depends on ────────────────
  const calls: Array<{ endpoint: string; ok: boolean }> = [];
  let albums: AlbumRef[] = [];

  if (config.needsCredentials) {
    findings.push({
      id: 'immich-api',
      level: 'error',
      title: 'No Immich URL or API key configured',
      detail: 'Set IMMICH_API_URL and IMMICH_API_KEY, or run the setup wizard at /install.',
    });
  } else {
    const headers = { 'x-api-key': config.immich.apiKey, Accept: 'application/json' };
    const call = async (endpoint: string, init?: RequestInit) => {
      try {
        const res = await fetch(`${config.immich.apiUrl}${endpoint}`, {
          headers,
          signal: AbortSignal.timeout(config.immichTimeoutMs),
          ...init,
        });
        calls.push({ endpoint, ok: res.ok });
        return res.ok ? res : null;
      } catch {
        calls.push({ endpoint, ok: false });
        return null;
      }
    };

    await call('/server/ping');
    const albumRes = await call('/albums');
    await call('/search/metadata', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 1, page: 1 }),
    });

    if (albumRes) {
      try {
        albums = (await albumRes.json()) as AlbumRef[];
      } catch {
        // A malformed body is already reflected by the call above.
      }
    }

    findings.push(checkImmichCalls(calls));
  }

  if (albums.length) {
    findings.push(checkAlbumIds(config.albums, albums));
    findings.push(checkAlbumsShared(config.albums, albums));
  }

  // ── Passwords: every place one can be configured ─────────────────────
  const passwords: PasswordRef[] = [];
  if (config.sitePassword) passwords.push({ label: 'Site password', value: config.sitePassword });
  for (const sp of config.subpages) {
    if (sp.password) passwords.push({ label: `Subpage ${sp.slug}`, value: sp.password });
  }
  for (const [slug, value] of Object.entries(config.albumPasswords)) {
    if (value) passwords.push({ label: `Album ${slug}`, value });
  }
  try {
    for (const entry of await listJournalEntries()) {
      const password = entry.frontmatter.password;
      if (password) passwords.push({ label: `Journal ${entry.slug}`, value: password });
    }
  } catch {
    // Journal entries are optional; a missing directory is not a fault.
  }
  findings.push(checkPasswords(passwords));

  // ── Writability of the content volume ────────────────────────────────
  const contentDir = path.join(process.cwd(), 'content');
  const unwritable: string[] = [];
  for (const dir of ['', '.backups', 'journal']) {
    const target = path.join(contentDir, dir);
    try {
      await fs.access(target, (await import('node:fs')).constants.W_OK);
    } catch {
      // A directory that does not exist yet is fine as long as its parent is
      // writable — only report one that exists and refuses writes.
      try {
        await fs.stat(target);
        unwritable.push(`content/${dir}`.replace(/\/$/, ''));
      } catch {
        // Not created yet.
      }
    }
  }
  findings.push(checkWritable(unwritable));

  return NextResponse.json(
    { level: worstLevel(findings), findings },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
