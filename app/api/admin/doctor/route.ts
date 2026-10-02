import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig, slugify } from '@/lib/config';
// From the pure schema module, like lib/auth.ts: tests stub the config barrel.
import { resolveZoom } from '@/lib/config/schema';
import { ZOOM_CONTENT_TYPES, zoomSourceFor } from '@/lib/zoomSource';
import { env } from '@/lib/env';
import { listJournalEntries } from '@/lib/admin/journal-service';
import { readSettingsYaml } from '@/lib/admin/yaml-service';
import { validateSettingValues } from '@/lib/config/settingValues';
import { readPrivacy } from '@/lib/privacy';
import { listPageSlugsSync } from '@/lib/admin/pages-service';
import { takenPageSlugs } from '@/lib/admin/pageSlugs';
import { describeCollision, menuPageSlugs, pageSlugCollision } from '@/lib/pages';
import { immich } from '@/lib/immich';
import { isLocationScrubbable } from '@/lib/locationScrub';
import {
  checkAlbumIds,
  checkAlbumSlugCollisions,
  checkAlbumsShared,
  checkAuthSecret,
  checkCdn,
  checkImmichCalls,
  checkContact,
  checkContentPages,
  checkDownloadMetadata,
  checkLegal,
  checkPrivacy,
  checkSettingValues,
  checkPasswords,
  checkProxyHops,
  checkWritable,
  checkZoomRenditions,
  countForwardedHops,
  PROXY_MARKER_HEADERS,
  worstLevel,
  type AlbumRef,
  type AlbumSlugGroup,
  type DoctorFinding,
  type DownloadAlbumRef,
  type ContactRef,
  type LegalRef,
  type PasswordRef,
  type ZoomAlbumRef,
  type ZoomRenditionSample,
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

      // Originals whose metadata a download cannot clean. Through the album
      // cache, like the alt-text report; an album that cannot be read is
      // already reported above and is skipped here.
      const downloadAlbums: DownloadAlbumRef[] = [];
      for (const id of config.albums.filter((albumId) => config.albumDownloads?.[albumId])) {
        try {
          const album = await immich.getAlbum(id);
          if (!album) continue;
          const uncleanable = album.assets.filter((asset) => !isLocationScrubbable(asset));
          downloadAlbums.push({
            id,
            albumName: album.albumName,
            uncleanable: uncleanable.length,
            uncleanableWithLocation: uncleanable.filter(
              (asset) => asset.exifInfo?.latitude != null && asset.exifInfo?.longitude != null,
            ).length,
          });
        } catch {
          // Immich unreachable: the connection check says so.
        }
      }
      const downloads = checkDownloadMetadata(downloadAlbums);
      if (downloads) findings.push(downloads);

      // Lightbox zoom (#467): photos a browser cannot show need Immich's
      // full-size rendition. Whether Immich has them is only known by asking,
      // so one such photo is sampled. "On" here means on for any route to the
      // album, standalone or through an enabled subpage.
      const zoomAlbums: ZoomAlbumRef[] = [];
      let renditionSample: ZoomRenditionSample | null = null;
      try {
        const zoomOn = (albumId: string) =>
          (config.standaloneAlbums.includes(albumId) && resolveZoom(config, albumId)) ||
          config.subpages.some(
            (sp) =>
              sp.enabled !== false &&
              sp.albumIds.includes(albumId) &&
              resolveZoom(config, albumId, sp),
          );
        let sample: string | undefined;
        for (const id of config.albums.filter(zoomOn)) {
          try {
            const album = await immich.getAlbum(id);
            if (!album) continue;
            const viaRendition = album.assets.filter(
              (asset) => zoomSourceFor(asset) === 'fullsize',
            );
            sample ??= viaRendition[0]?.id;
            zoomAlbums.push({ id, albumName: album.albumName, needRendition: viaRendition.length });
          } catch {
            // Immich unreachable: the connection check says so.
          }
        }
        if (sample) {
          try {
            const rendition = await immich.streamFullsize(sample);
            if (!rendition) {
              renditionSample = 'missing';
            } else {
              await (rendition.stream as ReadableStream).cancel().catch(() => {});
              // The zoom route serves only what it can scrub: a WebP rendition
              // exists, and is still refused.
              const type = rendition.contentType.toLowerCase().split(';')[0].trim();
              renditionSample = ZOOM_CONTENT_TYPES.has(type) ? 'ok' : { contentType: type };
            }
          } catch {
            // Unknown; reported as nothing rather than as a false alarm.
          }
        }
      } catch {
        // Best-effort, like every check here: no finding rather than no report.
      }
      const zoomFinding = checkZoomRenditions(zoomAlbums, renditionSample);
      if (zoomFinding) findings.push(zoomFinding);
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

  // ── Impressum and contact form: judged on the raw blocks, see checkLegal ──
  let rawLegal: LegalRef = config.legal;
  let rawContact: ContactRef = config.contact;
  try {
    const settings = await readSettingsYaml();
    rawLegal = settings?.legal ?? rawLegal;
    rawContact = settings?.contact ?? rawContact;
    // Values the resolvers replaced on the way into `config` — only the raw
    // file still shows them.
    findings.push(checkSettingValues(validateSettingValues(settings)));
  } catch {
    // Fall back to the resolved blocks; only a dropped URL goes unseen.
  }
  const legal = checkLegal(rawLegal, config.contact.enabled);
  if (legal) findings.push(legal);
  const contact = checkContact(rawContact, env.CONTACT_NOTIFY_URL);
  if (contact) findings.push(contact);
  const privacy = checkPrivacy({
    legalEnabled: config.legal.enabled,
    privacyEnabled: config.privacy.enabled,
    hasText: readPrivacy() !== '',
  });
  if (privacy) findings.push(privacy);

  // ── Content pages: missing menu targets and slug collisions (#722) ────
  try {
    const pageSlugs = listPageSlugsSync();
    const taken = pageSlugs.length ? await takenPageSlugs() : null;
    const collisions = taken
      ? pageSlugs.flatMap((slug) => {
          const collision = pageSlugCollision(slug, taken);
          return collision ? [{ slug, reason: describeCollision(slug, collision) }] : [];
        })
      : [];
    const pages = checkContentPages({
      menuRefs: menuPageSlugs(config.nav),
      pages: pageSlugs,
      collisions,
    });
    if (pages) findings.push(pages);
  } catch {
    // Pages are optional; a failure to list them is not a finding of its own.
  }

  // ── Writability of the content volume ────────────────────────────────
  const contentDir = path.join(process.cwd(), 'content');
  const unwritable: string[] = [];
  for (const dir of ['', '.backups', 'journal', 'pages']) {
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
