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

export function checkAuthSecret(secret: string | undefined): DoctorFinding {
  const length = secret?.length ?? 0;

  if (!length) {
    return {
      id: 'auth-secret',
      level: 'error',
      title: 'AUTH_SECRET is not set',
      detail:
        'Asset tokens and every auth cookie are signed with a secret regenerated on each ' +
        'restart, so links and logins break whenever the server restarts. Set AUTH_SECRET to a ' +
        'long random string.',
    };
  }

  if (length < AUTH_SECRET_MIN_LENGTH) {
    return {
      id: 'auth-secret',
      level: 'warn',
      title: `AUTH_SECRET is only ${length} characters`,
      detail: `Use at least ${AUTH_SECRET_MIN_LENGTH} random characters — it is the key behind every asset token and auth cookie.`,
    };
  }

  return {
    id: 'auth-secret',
    level: 'ok',
    title: 'AUTH_SECRET is set',
    detail: `${length} characters.`,
  };
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
): DoctorFinding {
  // One entry with nothing to corroborate it is what Next writes for a direct
  // request. Not evidence of anything.
  const inconclusive = observedHops === 1 && !hasProxyMarker;
  const provenHops = inconclusive ? 0 : observedHops;

  if (provenHops === 0 && configuredHops === 0) {
    return {
      id: 'proxy-hops',
      level: 'ok',
      title: 'No reverse proxy detected',
      detail: inconclusive
        ? 'The only X-Forwarded-For entry is the one Next fills in for a direct request, which matches TRUSTED_PROXY_HOPS=0.'
        : 'This request arrived without X-Forwarded-For, matching TRUSTED_PROXY_HOPS=0.',
    };
  }

  if (provenHops === 0 && configuredHops > 0) {
    return {
      id: 'proxy-hops',
      level: 'warn',
      title: `TRUSTED_PROXY_HOPS is ${configuredHops}, but this request shows no proxy`,
      detail:
        'Either you reached the admin panel directly while public traffic goes through a proxy — ' +
        'in which case this is fine — or the value is too high and every visitor shares one rate-limit bucket.',
    };
  }

  if (configuredHops === 0) {
    return {
      id: 'proxy-hops',
      level: 'warn',
      title: `A proxy chain of ${provenHops} was seen, but TRUSTED_PROXY_HOPS is 0`,
      detail:
        'The client IP is read from a header the client can set, so rate limiting can be bypassed ' +
        `by spoofing it. Set TRUSTED_PROXY_HOPS to ${provenHops} (nginx, Traefik or Caddy alone = 1).`,
    };
  }

  if (configuredHops > provenHops) {
    return {
      id: 'proxy-hops',
      level: 'warn',
      title: `TRUSTED_PROXY_HOPS is ${configuredHops}, but only ${provenHops} proxy ${
        provenHops === 1 ? 'hop was' : 'hops were'
      } seen`,
      detail:
        'The position being read lies before the start of the chain, so the client IP falls back to ' +
        `something unreliable. ${provenHops} is what this request suggests.`,
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
      title: `TRUSTED_PROXY_HOPS is ${configuredHops}, but a chain of ${provenHops} proxy hops was seen`,
      detail:
        'The client IP is read from a position still inside the proxy chain, not the real client — ' +
        `every visitor behind that hop can share one rate-limit bucket. ${provenHops} is what this request suggests.`,
    };
  }

  return {
    id: 'proxy-hops',
    level: 'ok',
    title: `TRUSTED_PROXY_HOPS=${configuredHops} matches the observed chain`,
    detail: `X-Forwarded-For carried ${provenHops} ${provenHops === 1 ? 'entry' : 'entries'} on this request.`,
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
): DoctorFinding | null {
  if (!cdnUrl) return null;

  if (sitePasswordSet) {
    return {
      id: 'cdn',
      level: 'warn',
      title: 'CDN_URL is set, but photos are served from this server',
      detail:
        'The site is password-protected, and a CDN would hand cached photos to anyone with a ' +
        'link, so CDN mode stays off. Remove the site password or unset CDN_URL.',
    };
  }

  if (trustedProxyHops === 0) {
    return {
      id: 'cdn',
      level: 'warn',
      title: 'CDN mode is on, but TRUSTED_PROXY_HOPS is 0',
      detail:
        `Photos are served through ${cdnUrl}, and without TRUSTED_PROXY_HOPS the rate limiter ` +
        'counts the CDN edge instead of the visitor. Set it to the number of proxies in front of ' +
        'the app, the CDN included.',
    };
  }

  return {
    id: 'cdn',
    level: 'ok',
    title: 'CDN mode is on',
    detail: `Photos and videos are served through ${cdnUrl}.`,
  };
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
export function checkAlbumIds(configured: string[], known: AlbumRef[]): DoctorFinding {
  const ids = new Set(known.map((a) => a.id));
  const missing = configured.filter((id) => !ids.has(id));

  if (!configured.length) {
    return {
      id: 'album-ids',
      level: 'warn',
      title: 'No albums configured',
      detail: 'gallery.yaml lists no albums, so the gallery has nothing to show.',
    };
  }

  if (missing.length) {
    return {
      id: 'album-ids',
      level: 'error',
      title: `${missing.length} of ${configured.length} album IDs do not exist in Immich`,
      detail: `Those pages are silently empty. Check gallery.yaml for: ${missing.join(', ')}`,
      albumIds: missing,
    };
  }

  return {
    id: 'album-ids',
    level: 'ok',
    title: `All ${configured.length} album IDs resolve`,
    detail: 'Every album in gallery.yaml exists in Immich.',
  };
}

/**
 * Published albums that are not shared in Immich.
 *
 * A warning, never an error: the `?shared=true` request filter has no effect on
 * current Immich (#515), so publishing an unshared album has always worked.
 * Naming them restores the accident-prevention this was meant to give.
 */
export function checkAlbumsShared(configured: string[], known: AlbumRef[]): DoctorFinding {
  const byId = new Map(known.map((a) => [a.id, a]));
  const unshared = configured
    .map((id) => byId.get(id))
    .filter((a): a is AlbumRef => !!a && a.shared === false);

  if (!unshared.length) {
    return {
      id: 'albums-shared',
      level: 'ok',
      title: 'Every published album is shared in Immich',
      detail: 'Nothing is published that Immich still considers private.',
    };
  }

  return {
    id: 'albums-shared',
    level: 'warn',
    title: `${unshared.length} published ${unshared.length === 1 ? 'album is' : 'albums are'} not shared in Immich`,
    detail:
      'They are served to visitors regardless — the allowlist in gallery.yaml is what decides. ' +
      `Worth a look if it was unintentional: ${unshared.map((a) => a.albumName).join(', ')}`,
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
export function checkDownloadMetadata(albums: DownloadAlbumRef[]): DoctorFinding | null {
  if (!albums.length) return null;
  const affected = albums.filter((a) => a.uncleanable > 0);

  if (!affected.length) {
    return {
      id: 'download-metadata',
      level: 'ok',
      title: 'Downloads go out without GPS',
      detail: `Every original in the ${albums.length === 1 ? 'download album' : `${albums.length} download albums`} is JPEG, HEIC or AVIF, and is served with its location removed.`,
    };
  }

  const files = affected.reduce((n, a) => n + a.uncleanable, 0);
  const located = affected.reduce((n, a) => n + a.uncleanableWithLocation, 0);
  return {
    id: 'download-metadata',
    level: 'warn',
    title: `${files} downloadable ${files === 1 ? 'original keeps' : 'originals keep'} all metadata`,
    detail:
      'RAW, DNG, PNG, TIFF, WebP and video files are served exactly as stored, with any GPS ' +
      `coordinates${located ? ` (Immich has a location for ${located} of them)` : ''}. ` +
      'Turn off downloads or remove these files if their location should stay private: ' +
      affected.map((a) => `${a.albumName} (${a.uncleanable})`).join(', '),
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
): DoctorFinding | null {
  const affected = albums.filter((a) => a.needRendition > 0);
  if (!affected.length || sample === null) return null;
  const photos = affected.reduce((n, a) => n + a.needRendition, 0);
  const noun = photos === 1 ? 'photo' : 'photos';
  const albumList = affected.map((a) => `${a.albumName} (${a.needRendition})`).join(', ');

  if (sample === 'ok') {
    return {
      id: 'zoom-renditions',
      level: 'ok',
      title: 'Immich has full-size previews for zoom',
      detail: `${photos} HEIC, RAW or similar ${noun} in zoom albums are zoomed through Immich's full-size rendition, with the location removed.`,
    };
  }
  if (sample === 'missing') {
    return {
      id: 'zoom-renditions',
      level: 'warn',
      title: `${photos} ${noun} cannot be zoomed: Immich has no full-size preview`,
      detail:
        'HEIC, RAW and other formats a browser cannot show are zoomed through Immich’s full-size ' +
        'rendition, and Immich has none (one photo sampled). Visitors see the zoom button and then ' +
        '"not available". In Immich, turn on Administration › Settings › Image Settings › Full-size ' +
        'image (JPEG), then run the Generate Thumbnails job for missing assets. Albums: ' +
        albumList,
      albumIds: affected.map((a) => a.id),
    };
  }
  return {
    id: 'zoom-renditions',
    level: 'warn',
    title: `${photos} ${noun} cannot be zoomed: Immich's full-size format is not JPEG`,
    detail:
      `Immich renders its full-size previews as ${sample.contentType || 'an unknown type'}, and ` +
      'zoom only serves JPEG renditions — their location metadata is removed on the way out, which ' +
      'Folio cannot do for WebP. Set Administration › Settings › Image Settings › Full-size image ' +
      '› Format to JPEG, then run the Generate Thumbnails job. Albums: ' +
      albumList,
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
): DoctorFinding {
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
        `${group.context}: "${collided.map((a) => a.name).join('" and "')}" all resolve to /${slug}`,
      );
      collidingIds.push(...collided.map((a) => a.id));
    }
  }

  if (collisions.length) {
    return {
      id: 'album-slugs',
      level: 'error',
      title: `${collisions.length} album slug ${collisions.length === 1 ? 'collision' : 'collisions'} found`,
      detail:
        'Every album after the first in a collision is unreachable at its own URL, and its ' +
        `settings resolve from the one before it. ${collisions.join('; ')}`,
      albumIds: collidingIds,
    };
  }

  return {
    id: 'album-slugs',
    level: 'ok',
    title: 'No album slug collisions',
    detail: 'Every album reachable under the same URL prefix has a distinct slug.',
  };
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
export function checkPasswords(passwords: PasswordRef[]): DoctorFinding {
  const bcrypt = passwords.filter((p) => /^\$2[aby]\$/.test(p.value));
  const plaintext = passwords.filter(
    (p) => !p.value.startsWith('scrypt:') && !/^\$2[aby]\$/.test(p.value),
  );

  if (bcrypt.length) {
    return {
      id: 'passwords',
      level: 'error',
      title: `${bcrypt.length} password${bcrypt.length === 1 ? '' : 's'} still use bcrypt`,
      detail:
        'Bcrypt support was removed, so nobody can unlock these at all. Replace with plaintext ' +
        `once, log in, and paste the scrypt: hash from the log: ${bcrypt.map((p) => p.label).join(', ')}`,
    };
  }

  if (plaintext.length) {
    return {
      id: 'passwords',
      level: 'warn',
      title: `${plaintext.length} password${plaintext.length === 1 ? ' is' : 's are'} stored in plaintext`,
      detail:
        'Anyone who reads the file reads the password. Saving the page, entry or setting once ' +
        'in the admin panel stores it hashed; for a hand-edited file, log in once and paste the ' +
        `scrypt: hash printed to the server log: ${plaintext.map((p) => p.label).join(', ')}`,
    };
  }

  if (!passwords.length) {
    return {
      id: 'passwords',
      level: 'ok',
      title: 'No passwords configured',
      detail: 'Nothing on this site is password-protected.',
    };
  }

  return {
    id: 'passwords',
    level: 'ok',
    title: `All ${passwords.length} passwords are hashed`,
    detail: 'Every configured password uses a scrypt: hash.',
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
): DoctorFinding | null {
  if (!legal || legal.enabled !== true) return null;

  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const email = text(legal.email);
  const phone = text(legal.phone);
  const rawUrl = text(legal.contactUrl);
  const contactUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
  const secondChannel = phone || contactUrl || contactFormEnabled;

  const problems: string[] = [];
  const missing = (
    [
      ['name', legal.name],
      ['street address', legal.address],
      ['ZIP and city', legal.zipCity],
    ] as const
  )
    .filter(([, value]) => !text(value))
    .map(([label]) => label);
  if (missing.length) problems.push(`Missing: ${missing.join(', ')}.`);
  if (!email) problems.push('No email address; § 5 DDG requires one.');
  if (rawUrl && !contactUrl) {
    problems.push('The contact form URL is ignored because it does not start with http(s)://.');
  }
  if (email && !secondChannel) {
    problems.push(
      'Email is the only contact channel. Add a phone number, a contact form URL, or turn on the built-in contact form.',
    );
  }

  if (problems.length) {
    return {
      id: 'legal',
      level: 'warn',
      title: `The Impressum has ${problems.length} gap${problems.length === 1 ? '' : 's'}`,
      detail: problems.join(' '),
    };
  }

  return {
    id: 'legal',
    level: 'ok',
    title: 'The Impressum is complete',
    detail: 'Name, address, email and a second contact channel are set.',
  };
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
): DoctorFinding | null {
  if (!contact || contact.enabled !== true) return null;
  const url =
    envNotifyUrl?.trim() || (typeof contact.notifyUrl === 'string' ? contact.notifyUrl.trim() : '');

  if (!url) {
    return {
      id: 'contact',
      level: 'warn',
      title: 'Contact form messages notify nobody',
      detail:
        'New messages only show up under Messages in the admin panel. Set an ntfy URL so you hear about them.',
    };
  }
  if (!/^https?:\/\//i.test(url)) {
    return {
      id: 'contact',
      level: 'warn',
      title: 'The contact notification URL is ignored',
      detail: 'It does not start with http(s)://, so no notification is sent.',
    };
  }
  return {
    id: 'contact',
    level: 'ok',
    title: 'Contact form notifies you',
    detail: 'Each new message triggers a notification.',
  };
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

/** Human names for the same fields, for the finding's text. */
const SETTING_LABELS: Record<string, string> = {
  url: 'Site URL',
  'theme.accent': 'accent colour',
  'theme.radius': 'corner radius',
  'grid.columns': 'grid columns',
  'grid.gap': 'grid gap',
  'contact.retentionDays': 'message retention',
  navLinks: 'header links',
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
export function checkSettingValues(errors: Array<{ field: string }>): DoctorFinding {
  if (errors.length === 0) {
    return {
      id: 'settings-values',
      level: 'ok',
      title: 'Settings are used as written',
      detail:
        'Site URL, theme, grid, message retention and header links in settings.yaml are all valid.',
    };
  }
  const keys = [...new Set(errors.map((e) => settingKey(e.field)))];
  const names = keys.map((key) => SETTING_LABELS[key] ?? key);
  return {
    id: 'settings-values',
    level: 'warn',
    title:
      names.length === 1
        ? `The ${names[0]} setting is ignored`
        : `${names.length} settings are ignored`,
    detail:
      `settings.yaml holds a value the site cannot use for: ${names.join(', ')}. ` +
      'The site uses a default or the nearest allowed value instead. Open the setting to see what it expects.',
    settingsSection: SETTING_SECTIONS[keys[0]],
  };
}

/**
 * A site that needs an Impressum almost always needs a privacy policy too
 * (Art. 13 GDPR). Returns null while there is neither an Impressum nor a
 * policy, so a site that has chosen to have no legal pages is not nagged.
 */
export function checkPrivacy(p: {
  legalEnabled: boolean;
  privacyEnabled: boolean;
  hasText: boolean;
}): DoctorFinding | null {
  if (p.privacyEnabled && p.hasText) {
    return {
      id: 'privacy',
      level: 'ok',
      title: 'The privacy policy is published',
      detail: 'Shown at /privacy and linked in the footer.',
    };
  }
  if (!p.legalEnabled) return null;
  return {
    id: 'privacy',
    level: 'warn',
    title: 'There is no privacy policy',
    detail: p.hasText
      ? 'The text exists but the privacy page is switched off, so /privacy answers 404.'
      : 'The Impressum is on but /privacy has no text. Settings → Legal lists what this site processes, as a starting point.',
  };
}

/**
 * The whole content directory must be writable: the wizard, the admin panel,
 * the journal, favicon upload, analytics and backup rotation all write there.
 */
export function checkWritable(unwritable: string[]): DoctorFinding {
  if (unwritable.length) {
    return {
      id: 'content-writable',
      level: 'error',
      title: `${unwritable.length} content ${unwritable.length === 1 ? 'path is' : 'paths are'} not writable`,
      detail:
        'Saving from the admin panel will fail, and so will backups. Check the ownership of the ' +
        `mounted volume: ${unwritable.join(', ')}`,
    };
  }

  return {
    id: 'content-writable',
    level: 'ok',
    title: 'content/ is writable',
    detail: 'Config, journal and backups can be saved.',
  };
}

/**
 * Whether the calls Folio actually makes to Immich succeed.
 *
 * Deliberately not phrased as "are the API key permissions sufficient": Immich
 * does not report what a key may do, so the only honest answer is whether the
 * three requests this app depends on came back.
 */
export function checkImmichCalls(results: Array<{ endpoint: string; ok: boolean }>): DoctorFinding {
  const failed = results.filter((r) => !r.ok);

  if (failed.length) {
    return {
      id: 'immich-api',
      level: 'error',
      title: `${failed.length} of ${results.length} Immich calls failed`,
      detail: `Check IMMICH_API_URL and the API key. Failing: ${failed.map((f) => f.endpoint).join(', ')}`,
    };
  }

  return {
    id: 'immich-api',
    level: 'ok',
    title: 'Immich answers every call Folio makes',
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
export function checkContentPages(p: {
  /** Slugs referenced from gallery.yaml. */
  menuRefs: string[];
  /** Slugs of the files in content/pages/. */
  pages: string[];
  collisions: PageSlugProblem[];
}): DoctorFinding | null {
  if (!p.menuRefs.length && !p.pages.length) return null;
  const existing = new Set(p.pages);
  const missing = p.menuRefs.filter((slug) => !existing.has(slug));
  const missingList = missing.map((s) => `"${s}"`).join(', ');

  if (p.collisions.length) {
    const n = p.collisions.length;
    return {
      id: 'content-pages',
      level: 'error',
      title: `${n} content ${n === 1 ? 'page has' : 'pages have'} a slug that is already taken`,
      detail:
        p.collisions.map((c) => c.reason).join(' ') +
        ' Rename the page in Pages so visitors can reach it.' +
        (missing.length ? ` The menu also lists missing pages: ${missingList}.` : ''),
    };
  }

  if (missing.length) {
    return {
      id: 'content-pages',
      level: 'warn',
      title: `The menu lists ${missing.length} missing ${missing.length === 1 ? 'page' : 'pages'}`,
      detail:
        `gallery.yaml references ${missingList}, but content/pages/ has no such file. ` +
        'The menu skips the entry; remove the reference or create the page.',
    };
  }

  const n = p.pages.length;
  return {
    id: 'content-pages',
    level: 'ok',
    title: `${n} content ${n === 1 ? 'page' : 'pages'}, every slug free`,
    detail: `${p.menuRefs.length} of them in the menu.`,
  };
}
