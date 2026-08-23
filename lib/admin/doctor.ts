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

  return {
    id: 'proxy-hops',
    level: 'ok',
    title: `TRUSTED_PROXY_HOPS=${configuredHops} matches the observed chain`,
    detail: `X-Forwarded-For carried ${provenHops} ${provenHops === 1 ? 'entry' : 'entries'} on this request.`,
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
        'Anyone who reads the file reads the password. Log in once and replace it with the ' +
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
