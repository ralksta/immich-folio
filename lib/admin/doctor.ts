/**
 * Config doctor — the handful of misconfigurations behind almost every
 * "it does not work for me" report (#491).
 *
 * Every check is a pure function over inputs the caller has already gathered,
 * so the whole set is unit-testable without mocking fs, Immich or a request.
 * The route does the gathering; this module does the judging.
 *
 * A finding never carries a secret. Not the AUTH_SECRET, not a password, not
 * the API key — only whether something is set, and where to look.
 */

// The finding texts (#604). A relative import with its extension, onto an
// import-free file, so `npm run doctor` can still load this module with Node's
// own type stripping (#521). Every check takes the dictionary as its last
// argument and falls back to English, which is what the CLI and the tests use.
import { doctor as doctorEn } from '../i18n/admin/en/doctor.ts';

/** The doctor's part of the admin dictionary. */
export type DoctorText = typeof doctorEn;

export type DoctorLevel = 'ok' | 'warn' | 'error';

export interface DoctorFinding {
  /** Stable identifier, so the UI and a future CLI can agree on a check. */
  id: string;
  level: DoctorLevel;
  title: string;
  /** One sentence: what was observed, and what to do about it. */
  detail: string;
  /**
   * The Immich album IDs a finding is about, when it is about albums — so the
   * diagnostics page can link straight to the album in the page builder.
   */
  albumIds?: string[];
  /**
   * The settings section (`/admin/settings/<section>`) that holds the fix, when
   * it depends on the finding rather than on its id.
   */
  settingsSection?: string;
}

/** The worst level present — what the status badge should show. */
export function worstLevel(findings: DoctorFinding[]): DoctorLevel {
  if (findings.some((f) => f.level === 'error')) return 'error';
  if (findings.some((f) => f.level === 'warn')) return 'warn';
  return 'ok';
}

/**
 * `AUTH_SECRET` derives the asset-token key and every auth cookie's HMAC.
 * Missing in production throws at startup, so the case that actually reaches a
 * running site is a secret that is set but too short to be worth much.
 */
export const AUTH_SECRET_MIN_LENGTH = 32;

export function checkAuthSecret(
  secret: string | undefined,
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.authSecret;
  const length = secret?.length ?? 0;

  if (!length) {
    return { id: 'auth-secret', level: 'error', title: t.missingTitle, detail: t.missingDetail };
  }

  if (length < AUTH_SECRET_MIN_LENGTH) {
    return {
      id: 'auth-secret',
      level: 'warn',
      title: t.shortTitle(length),
      detail: t.shortDetail(AUTH_SECRET_MIN_LENGTH),
    };
  }

  return { id: 'auth-secret', level: 'ok', title: t.okTitle, detail: t.okDetail(length) };
}

/**
 * `TRUSTED_PROXY_HOPS` says how far from the right of `X-Forwarded-For` the
 * real client IP sits. Wrong values fail silently: too high and the lookup
 * falls off the end of the chain, too low and the IP comes from a header the
 * client can write — either way rate limiting stops telling visitors apart,
 * and nothing in the log says so.
 *
 * The measurement is trickier than it looks. Next fills in every `x-forwarded-*`
 * header itself when the request arrives without one
 * (`base-server.js`: `req.headers['x-forwarded-for'] ??= socket.remoteAddress`),
 * so a chain of exactly one entry is what a *direct* request looks like too —
 * warning on it would fire on every deployment that has no proxy at all. A
 * single entry therefore only counts as evidence of a proxy when something Next
 * does not synthesise is present as well: `x-real-ip`, `forwarded` or `via`.
 *
 * Even then this is evidence, not proof: an admin reaching the panel directly on
 * the LAN sees a different path than public traffic through the reverse proxy.
 */
export function checkProxyHops(
  configuredHops: number,
  observedHops: number,
  /** A header a real proxy sets and Next never invents. */
  hasProxyMarker = false,
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.proxyHops;
  // One entry with nothing to corroborate it is what Next writes for a direct
  // request. Not evidence of anything.
  const inconclusive = observedHops === 1 && !hasProxyMarker;
  const provenHops = inconclusive ? 0 : observedHops;

  if (provenHops === 0 && configuredHops === 0) {
    return {
      id: 'proxy-hops',
      level: 'ok',
      title: t.noProxyTitle,
      detail: inconclusive ? t.noProxyInconclusiveDetail : t.noProxyDetail,
    };
  }

  if (provenHops === 0 && configuredHops > 0) {
    return {
      id: 'proxy-hops',
      level: 'warn',
      title: t.notSeenTitle(configuredHops),
      detail: t.notSeenDetail,
    };
  }

  if (configuredHops === 0) {
    return {
      id: 'proxy-hops',
      level: 'warn',
      title: t.unsetTitle(provenHops),
      detail: t.unsetDetail(provenHops),
    };
  }

  if (configuredHops > provenHops) {
    return {
      id: 'proxy-hops',
      level: 'warn',
      title: t.tooHighTitle(configuredHops, provenHops),
      detail: t.tooHighDetail(provenHops),
    };
  }

  // configuredHops is between 0 and provenHops (both handled above), so the
  // position read is still inside the chain rather than at its start: every
  // request is read from a proxy's own address, not the client behind it.
  // Cloudflare (1 hop) in front of nginx (1 more, 2 total) with the value set
  // to 1 reads the Cloudflare edge address, and every visitor behind that
  // edge shares one rate-limit bucket — this used to report "matches the
  // observed chain".
  if (configuredHops < provenHops) {
    return {
      id: 'proxy-hops',
      level: 'warn',
      title: t.tooLowTitle(configuredHops, provenHops),
      detail: t.tooLowDetail(provenHops),
    };
  }

  return {
    id: 'proxy-hops',
    level: 'ok',
    title: t.okTitle(configuredHops),
    detail: t.okDetail(provenHops),
  };
}

/**
 * CDN mode (lib/cdn.ts). Only reported when `CDN_URL` is set.
 *
 * Two ways it quietly goes wrong. A site password keeps the photos on this
 * host on purpose, which reads as "the CDN does nothing". And with
 * `TRUSTED_PROXY_HOPS=0`, every cache miss is rate-limited by the CDN edge's
 * IP instead of the visitor's: a handful of edges share one bucket, and a busy
 * page can push one of them into 429s that then show up as missing photos.
 */
export function checkCdn(
  cdnUrl: string | undefined,
  sitePasswordSet: boolean,
  trustedProxyHops: number,
  text: DoctorText = doctorEn,
): DoctorFinding | null {
  if (!cdnUrl) return null;
  const t = text.cdn;

  if (sitePasswordSet) {
    return { id: 'cdn', level: 'warn', title: t.passwordTitle, detail: t.passwordDetail };
  }

  if (trustedProxyHops === 0) {
    return { id: 'cdn', level: 'warn', title: t.noHopsTitle, detail: t.noHopsDetail(cdnUrl) };
  }

  return { id: 'cdn', level: 'ok', title: t.okTitle, detail: t.okDetail(cdnUrl) };
}

/** Headers a reverse proxy sets and Next never synthesises. */
export const PROXY_MARKER_HEADERS = ['x-real-ip', 'forwarded', 'via'];

/** Counts the entries of an `X-Forwarded-For` header. Absent or empty is 0. */
export function countForwardedHops(header: string | null | undefined): number {
  if (!header) return 0;
  return header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export interface AlbumRef {
  id: string;
  albumName: string;
  /** Whether Immich reports the album as shared. */
  shared?: boolean;
}

/**
 * Album IDs in gallery.yaml that Immich no longer knows.
 *
 * `validateUuid()` deliberately warns rather than throwing, so a typo or a
 * deleted album turns into a page that is silently missing an album.
 */
export function checkAlbumIds(
  configured: string[],
  known: AlbumRef[],
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.albumIds;
  const ids = new Set(known.map((a) => a.id));
  const missing = configured.filter((id) => !ids.has(id));

  if (!configured.length) {
    return { id: 'album-ids', level: 'warn', title: t.noneTitle, detail: t.noneDetail };
  }

  if (missing.length) {
    return {
      id: 'album-ids',
      level: 'error',
      title: t.missingTitle(missing.length, configured.length),
      detail: t.missingDetail(missing.join(', ')),
      albumIds: missing,
    };
  }

  return {
    id: 'album-ids',
    level: 'ok',
    title: t.okTitle(configured.length),
    detail: t.okDetail,
  };
}

/**
 * Published albums that are not shared in Immich.
 *
 * A warning, never an error: the `?shared=true` request filter has no effect on
 * current Immich (#515), so publishing an unshared album has always worked.
 * Naming them restores the accident-prevention this was meant to give.
 */
export function checkAlbumsShared(
  configured: string[],
  known: AlbumRef[],
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.albumsShared;
  const byId = new Map(known.map((a) => [a.id, a]));
  const unshared = configured
    .map((id) => byId.get(id))
    .filter((a): a is AlbumRef => !!a && a.shared === false);

  if (!unshared.length) {
    return { id: 'albums-shared', level: 'ok', title: t.okTitle, detail: t.okDetail };
  }

  return {
    id: 'albums-shared',
    level: 'warn',
    title: t.warnTitle(unshared.length),
    detail: t.warnDetail(unshared.map((a) => a.albumName).join(', ')),
    albumIds: unshared.map((a) => a.id),
  };
}

/** What the doctor needs to know about one album that offers downloads. */
export interface DownloadAlbumRef {
  id: string;
  albumName: string;
  /** Assets in a format whose metadata the download cannot clean (RAW, PNG, video, …). */
  uncleanable: number;
  /** Of those, how many Immich has coordinates for. */
  uncleanableWithLocation: number;
}

/**
 * Downloads remove GPS from JPEG, HEIC/HEIF and AVIF originals
 * (lib/locationScrub.ts). Every other format is served exactly as Immich
 * stores it, so an album that offers downloads and holds such files hands out
 * whatever location they carry. The route decides which assets are cleanable;
 * this module stays import-free for `npm run doctor`. Returns null while no
 * album offers downloads.
 */
export function checkDownloadMetadata(
  albums: DownloadAlbumRef[],
  text: DoctorText = doctorEn,
): DoctorFinding | null {
  if (!albums.length) return null;
  const t = text.downloadMetadata;
  const affected = albums.filter((a) => a.uncleanable > 0);

  if (!affected.length) {
    return {
      id: 'download-metadata',
      level: 'ok',
      title: t.okTitle,
      detail: t.okDetail(albums.length),
    };
  }

  const files = affected.reduce((n, a) => n + a.uncleanable, 0);
  const located = affected.reduce((n, a) => n + a.uncleanableWithLocation, 0);
  return {
    id: 'download-metadata',
    level: 'warn',
    title: t.warnTitle(files),
    detail: t.warnDetail(
      located,
      affected.map((a) => `${a.albumName} (${a.uncleanable})`).join(', '),
    ),
    albumIds: affected.map((a) => a.id),
  };
}

/** What the doctor needs to know about one album with lightbox zoom on (#467). */
export interface ZoomAlbumRef {
  id: string;
  albumName: string;
  /** Photos zoomed through Immich's full-size rendition (HEIC, RAW, TIFF, …). */
  needRendition: number;
}

/**
 * What the sampled full-size rendition turned out to be: `ok` (JPEG, which the
 * zoom route serves), `missing` (Immich has none), or the content type of one
 * the route refuses — a WebP rendition, when Immich's full-size format is set
 * to WebP, since the location scrubber cannot clean WebP.
 */
export type ZoomRenditionSample = 'ok' | 'missing' | { contentType: string };

/**
 * Zoom shows JPEG and AVIF originals directly, but everything a browser cannot
 * display needs Immich's full-size rendition, which Immich only generates while
 * "Full-size image" is on in its image settings, and which the zoom route only
 * serves as JPEG. Immich does not say whether a rendition exists until one is
 * asked for, so the route samples one photo and passes what it found (null
 * when it could not ask).
 *
 * Returns null when no zoom album holds such photos, or nothing is known.
 */
export function checkZoomRenditions(
  albums: ZoomAlbumRef[],
  sample: ZoomRenditionSample | null,
  text: DoctorText = doctorEn,
): DoctorFinding | null {
  const affected = albums.filter((a) => a.needRendition > 0);
  if (!affected.length || sample === null) return null;
  const t = text.zoomRenditions;
  const photos = affected.reduce((n, a) => n + a.needRendition, 0);
  const albumList = affected.map((a) => `${a.albumName} (${a.needRendition})`).join(', ');

  if (sample === 'ok') {
    return {
      id: 'zoom-renditions',
      level: 'ok',
      title: t.okTitle,
      detail: t.okDetail(photos),
    };
  }
  if (sample === 'missing') {
    return {
      id: 'zoom-renditions',
      level: 'warn',
      title: t.missingTitle(photos),
      detail: t.missingDetail(albumList),
      albumIds: affected.map((a) => a.id),
    };
  }
  return {
    id: 'zoom-renditions',
    level: 'warn',
    title: t.formatTitle(photos),
    detail: t.formatDetail(sample.contentType, albumList),
    albumIds: affected.map((a) => a.id),
  };
}

/** One set of albums that will all be reachable under the same URL prefix. */
export interface AlbumSlugGroup {
  /** e.g. "gallery.yaml albums" or `subpage "Trips"` */
  context: string;
  albumIds: string[];
}

/**
 * Album slug collisions using each album's *resolved* name — the title
 * override if one is set, otherwise whatever Immich calls it. deriveGallery
 * can only see the override half of that (#632); this is the other half,
 * checked against the live album list the doctor already has.
 *
 * `slugOf` is a parameter rather than an import so this file keeps the zero
 * dependencies it has had since #491 — the whole reason `scripts/doctor.mts`
 * can run this module directly through Node's native TypeScript stripping,
 * with no bundler and no `lib/config` (which pulls in `fs`).
 */
export function checkAlbumSlugCollisions(
  groups: AlbumSlugGroup[],
  overrides: Record<string, string>,
  known: AlbumRef[],
  slugOf: (name: string) => string,
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.albumSlugs;
  const byId = new Map(known.map((a) => [a.id, a]));
  const collisions: string[] = [];
  const collidingIds: string[] = [];

  for (const group of groups) {
    const named = group.albumIds
      .map((id) => ({ id, name: overrides[id] ?? byId.get(id)?.albumName }))
      .filter((a): a is { id: string; name: string } => !!a.name);

    const bySlug = new Map<string, typeof named>();
    for (const album of named) {
      const slug = slugOf(album.name);
      if (!slug) continue; // Falls back to the id elsewhere, which is unique.
      const list = bySlug.get(slug) ?? [];
      list.push(album);
      bySlug.set(slug, list);
    }

    for (const [slug, collided] of bySlug) {
      if (collided.length < 2) continue;
      collisions.push(
        t.collision(
          group.context,
          collided.map((a) => a.name),
          slug,
        ),
      );
      collidingIds.push(...collided.map((a) => a.id));
    }
  }

  if (collisions.length) {
    return {
      id: 'album-slugs',
      level: 'error',
      title: t.errorTitle(collisions.length),
      detail: t.errorDetail(collisions.join('; ')),
      albumIds: collidingIds,
    };
  }

  return { id: 'album-slugs', level: 'ok', title: t.okTitle, detail: t.okDetail };
}

export interface PasswordRef {
  /** Where it lives, for the report: "Album japan-2024", "Site password". */
  label: string;
  value: string;
}

/**
 * Passwords still stored in plaintext, or as a bcrypt hash that can no longer
 * be verified at all.
 *
 * lib/auth.ts warns about both on every login attempt — to the server log,
 * where nobody looks.
 */
export function checkPasswords(
  passwords: PasswordRef[],
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.passwords;
  const bcrypt = passwords.filter((p) => /^\$2[aby]\$/.test(p.value));
  const plaintext = passwords.filter(
    (p) => !p.value.startsWith('scrypt:') && !/^\$2[aby]\$/.test(p.value),
  );

  if (bcrypt.length) {
    return {
      id: 'passwords',
      level: 'error',
      title: t.bcryptTitle(bcrypt.length),
      detail: t.bcryptDetail(bcrypt.map((p) => p.label).join(', ')),
    };
  }

  if (plaintext.length) {
    return {
      id: 'passwords',
      level: 'warn',
      title: t.plaintextTitle(plaintext.length),
      detail: t.plaintextDetail(plaintext.map((p) => p.label).join(', ')),
    };
  }

  if (!passwords.length) {
    return { id: 'passwords', level: 'ok', title: t.noneTitle, detail: t.noneDetail };
  }

  return {
    id: 'passwords',
    level: 'ok',
    title: t.okTitle(passwords.length),
    detail: t.okDetail,
  };
}

/** The `legal:` block as settings.yaml holds it, before resolveLegal(). */
export interface LegalRef {
  enabled?: unknown;
  name?: unknown;
  address?: unknown;
  zipCity?: unknown;
  email?: unknown;
  phone?: unknown;
  contactUrl?: unknown;
}

/**
 * Whether an enabled Impressum carries what § 5 DDG asks for: a name and a
 * postal address, an email address, and a second fast way to get in touch
 * (phone or a contact form, ECJ C-298/07).
 *
 * It takes the raw block rather than the resolved one because resolveLegal()
 * drops a contact URL that is not http(s) and only tells the server log, so
 * the link would just go missing. The http(s) test repeats isHttpUrl() from
 * lib/config/schema.ts: this module has no imports, so the CLI can load it.
 * Returns null when the page is switched off.
 */
export function checkLegal(
  legal: LegalRef | null | undefined,
  /** The built-in form (#702) is linked from the Impressum when no contactUrl is set. */
  contactFormEnabled = false,
  dictionary: DoctorText = doctorEn,
): DoctorFinding | null {
  if (!legal || legal.enabled !== true) return null;
  const t = dictionary.legal;

  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const email = text(legal.email);
  const phone = text(legal.phone);
  const rawUrl = text(legal.contactUrl);
  const contactUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
  const secondChannel = phone || contactUrl || contactFormEnabled;

  const problems: string[] = [];
  const missing = (
    [
      [t.fieldName, legal.name],
      [t.fieldAddress, legal.address],
      [t.fieldZipCity, legal.zipCity],
    ] as const
  )
    .filter(([, value]) => !text(value))
    .map(([label]) => label);
  if (missing.length) problems.push(t.missing(missing.join(', ')));
  if (!email) problems.push(t.noEmail);
  if (rawUrl && !contactUrl) problems.push(t.badContactUrl);
  if (email && !secondChannel) problems.push(t.emailOnly);

  if (problems.length) {
    return {
      id: 'legal',
      level: 'warn',
      title: t.gapsTitle(problems.length),
      detail: problems.join(' '),
    };
  }

  return { id: 'legal', level: 'ok', title: t.okTitle, detail: t.okDetail };
}

/** The `contact:` block as settings.yaml holds it. */
export interface ContactRef {
  enabled?: unknown;
  notifyUrl?: unknown;
}

/**
 * The contact form stores messages without telling anyone unless a
 * notification URL is set. The ECJ reads the second contact channel as one
 * that allows "direct and effective" communication, and a form nobody looks
 * at does not. Returns null when the form is off.
 */
export function checkContact(
  contact: ContactRef | null | undefined,
  envNotifyUrl?: string,
  text: DoctorText = doctorEn,
): DoctorFinding | null {
  if (!contact || contact.enabled !== true) return null;
  const t = text.contact;
  const url =
    envNotifyUrl?.trim() || (typeof contact.notifyUrl === 'string' ? contact.notifyUrl.trim() : '');

  if (!url) {
    return { id: 'contact', level: 'warn', title: t.noNotifyTitle, detail: t.noNotifyDetail };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { id: 'contact', level: 'warn', title: t.badUrlTitle, detail: t.badUrlDetail };
  }
  return { id: 'contact', level: 'ok', title: t.okTitle, detail: t.okDetail };
}

/** Where each value checked by `validateSettingValues` is edited. */
const SETTING_SECTIONS: Record<string, string> = {
  url: 'seo',
  'theme.accent': 'theme',
  'theme.radius': 'theme',
  'grid.columns': 'grid',
  'grid.gap': 'grid',
  'contact.retentionDays': 'legal',
  navLinks: 'footer',
};

/** The dictionary label that names each of the same fields in the finding's text. */
const SETTING_LABELS: Record<string, keyof DoctorText['settingValues']['labels']> = {
  url: 'url',
  'theme.accent': 'themeAccent',
  'theme.radius': 'themeRadius',
  'grid.columns': 'gridColumns',
  'grid.gap': 'gridGap',
  'contact.retentionDays': 'retentionDays',
  navLinks: 'navLinks',
};

/** `navLinks.2.url` → `navLinks`: every header-link error is one setting. */
function settingKey(field: string): string {
  return field.startsWith('navLinks.') ? 'navLinks' : field;
}

/**
 * Values in settings.yaml the site does not use as written — an accent that is
 * not hex, a column count outside 1–6, a site URL that is not a full address.
 * The resolvers fall back or clamp, so nothing breaks and nothing says so; the
 * panel now refuses to save them, but a hand-edited file or one saved before
 * that still holds them. Takes `validateSettingValues(settings.yaml)`.
 */
export function checkSettingValues(
  errors: Array<{ field: string }>,
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.settingValues;
  if (errors.length === 0) {
    return { id: 'settings-values', level: 'ok', title: t.okTitle, detail: t.okDetail };
  }
  const keys = [...new Set(errors.map((e) => settingKey(e.field)))];
  const names = keys.map((key) => {
    const label = SETTING_LABELS[key];
    return label ? t.labels[label] : key;
  });
  return {
    id: 'settings-values',
    level: 'warn',
    title: names.length === 1 ? t.oneIgnoredTitle(names[0]) : t.manyIgnoredTitle(names.length),
    detail: t.ignoredDetail(names.join(', ')),
    settingsSection: SETTING_SECTIONS[keys[0]],
  };
}

/**
 * A site that needs an Impressum almost always needs a privacy policy too
 * (Art. 13 GDPR). Returns null while there is neither an Impressum nor a
 * policy, so a site that has chosen to have no legal pages is not nagged.
 */
export function checkPrivacy(
  p: {
    legalEnabled: boolean;
    privacyEnabled: boolean;
    hasText: boolean;
  },
  text: DoctorText = doctorEn,
): DoctorFinding | null {
  const t = text.privacy;
  if (p.privacyEnabled && p.hasText) {
    return { id: 'privacy', level: 'ok', title: t.okTitle, detail: t.okDetail };
  }
  if (!p.legalEnabled) return null;
  return {
    id: 'privacy',
    level: 'warn',
    title: t.missingTitle,
    detail: p.hasText ? t.switchedOffDetail : t.noTextDetail,
  };
}

/**
 * The whole content directory must be writable: the wizard, the admin panel,
 * the journal, favicon upload, analytics and backup rotation all write there.
 */
export function checkWritable(unwritable: string[], text: DoctorText = doctorEn): DoctorFinding {
  const t = text.writable;
  if (unwritable.length) {
    return {
      id: 'content-writable',
      level: 'error',
      title: t.errorTitle(unwritable.length),
      detail: t.errorDetail(unwritable.join(', ')),
    };
  }

  return { id: 'content-writable', level: 'ok', title: t.okTitle, detail: t.okDetail };
}

/**
 * Whether the calls Folio actually makes to Immich succeed.
 *
 * Deliberately not phrased as "are the API key permissions sufficient": Immich
 * does not report what a key may do, so the only honest answer is whether the
 * three requests this app depends on came back.
 */
export function checkImmichCalls(
  results: Array<{ endpoint: string; ok: boolean }>,
  text: DoctorText = doctorEn,
): DoctorFinding {
  const t = text.immichApi;
  const failed = results.filter((r) => !r.ok);

  if (failed.length) {
    return {
      id: 'immich-api',
      level: 'error',
      title: t.failedTitle(failed.length, results.length),
      detail: t.failedDetail(failed.map((f) => f.endpoint).join(', ')),
    };
  }

  return {
    id: 'immich-api',
    level: 'ok',
    title: t.okTitle,
    detail: results.map((r) => r.endpoint).join(', '),
  };
}

export interface PageSlugProblem {
  slug: string;
  /** One sentence from describeCollision(). */
  reason: string;
}

/**
 * Content pages (#722): a `- page:` reference in gallery.yaml whose file does
 * not exist puts nothing in the menu, and a page whose slug is already taken
 * is shadowed by the subpage or album — or, for a built-in route, never
 * reached at all. Returns null while there are no pages and no references.
 */
export function checkContentPages(
  p: {
    /** Slugs referenced from gallery.yaml. */
    menuRefs: string[];
    /** Slugs of the files in content/pages/. */
    pages: string[];
    collisions: PageSlugProblem[];
  },
  text: DoctorText = doctorEn,
): DoctorFinding | null {
  if (!p.menuRefs.length && !p.pages.length) return null;
  const t = text.contentPages;
  const existing = new Set(p.pages);
  const missing = p.menuRefs.filter((slug) => !existing.has(slug));
  const missingList = missing.map((s) => `"${s}"`).join(', ');

  if (p.collisions.length) {
    const n = p.collisions.length;
    return {
      id: 'content-pages',
      level: 'error',
      title: t.takenTitle(n),
      detail: t.takenDetail(p.collisions.map((c) => c.reason).join(' '), missingList),
    };
  }

  if (missing.length) {
    return {
      id: 'content-pages',
      level: 'warn',
      title: t.missingTitle(missing.length),
      detail: t.missingDetail(missingList),
    };
  }

  const n = p.pages.length;
  return {
    id: 'content-pages',
    level: 'ok',
    title: t.okTitle(n),
    detail: t.okDetail(p.menuRefs.length),
  };
}
