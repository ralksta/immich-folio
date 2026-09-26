import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig, slugify } from '@/lib/config';
import { env } from '@/lib/env';
import { listJournalEntries } from '@/lib/admin/journal-service';
import { readSettingsYaml } from '@/lib/admin/yaml-service';
import {
  checkAlbumIds,
  checkAlbumSlugCollisions,
  checkAlbumsShared,
  checkAuthSecret,
  checkCdn,
  checkImmichCalls,
  checkLegal,
  checkPasswords,
  checkProxyHops,
  checkWritable,
  countForwardedHops,
  PROXY_MARKER_HEADERS,
  worstLevel,
  type AlbumRef,
  type AlbumSlugGroup,
  type DoctorFinding,
  type LegalRef,
  type PasswordRef,
} from '@/lib/admin/doctor';

/**
 * Config doctor (#491). Gathers the evidence; lib/admin/doctor.ts judges it.
 *
 * Everything is best-effort: a check that cannot gather its input reports that
 * rather than failing the whole report, because a broken install is exactly
 * when this route needs to answer.
 */
export const GET = withAdmin(async (request: NextRequest) => {
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

  const cdn = checkCdn(env.CDN_URL, !!config.sitePassword, config.trustedProxyHops);
  if (cdn) findings.push(cdn);

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
        const parsed: unknown = await albumRes.json();
        if (Array.isArray(parsed)) albums = parsed as AlbumRef[];
      } catch {
        // A malformed body is already reflected by the call above.
      }
    }

    findings.push(checkImmichCalls(calls));

    // Whenever albums are configured, run the check even if Immich answered
    // with an empty list — an API key regenerated under a different account,
    // say. `if (albums.length)` used to skip this entirely, so a `200 []`
    // response passed every connection check and reported nothing about
    // albums at all, while every album page was silently empty (#629).
    // checkAlbumIds treats every configured ID as missing when none resolve.
    if (config.albums.length) {
      findings.push(checkAlbumIds(config.albums, albums));
      findings.push(checkAlbumsShared(config.albums, albums));

      // deriveGallery already rejects a slug collision between two albums
      // that both have a title override; this is the other half, using the
      // album's resolved name (override, or otherwise whatever Immich calls
      // it), which is only known once Immich has answered (#632).
      const slugGroups: AlbumSlugGroup[] = [
        { context: 'gallery.yaml albums', albumIds: config.standaloneAlbums },
        ...config.subpages.map((sp) => ({
          context: `subpage "${sp.name}"`,
          albumIds: sp.albumIds,
        })),
      ];
      findings.push(checkAlbumSlugCollisions(slugGroups, config.albumOverrides, albums, slugify));
    }
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

  // ── Impressum: judged on the raw block, see checkLegal ──────────────
  let rawLegal: LegalRef = config.legal;
  try {
    rawLegal = (await readSettingsYaml())?.legal ?? rawLegal;
  } catch {
    // Fall back to the resolved block; only a dropped contact URL goes unseen.
  }
  const legal = checkLegal(rawLegal);
  if (legal) findings.push(legal);

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
});
