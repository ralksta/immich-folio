/**
 * CDN mode — serve photos and videos through a pull CDN.
 *
 * With `CDN_URL` set, every image and video URL the server renders points at
 * the CDN instead of this host: `https://cdn.example.com/api/image/<token>…`.
 * The CDN is configured with this server as its origin, so a cache miss is
 * fetched from `/api/image` exactly as a browser would, and every hit after
 * that never reaches the server — or the Immich box behind it — at all.
 *
 * This works because the image and video routes are already CDN-shaped: the
 * URL is the whole capability (an opaque, deterministic token plus size, width,
 * quality and the IMAGE_CACHE_VERSION buster), the response does not depend on
 * cookies, and successful responses are `public, max-age=31536000, immutable`.
 *
 * Pages, `/_next` assets, EXIF, the map, downloads and every admin route stay
 * on this host. Pages are rendered per request, and the others either carry a
 * cookie check or are small enough not to matter.
 *
 * **A site-wide password turns CDN mode off.** On a locked site the image route
 * checks the visitor's unlock cookie, and a CDN would answer from its cache
 * without asking — every photo would be public to anyone holding a URL. So the
 * URLs quietly stay on this host while `sitePassword` is set, whatever CDN_URL
 * says, and the diagnostics page reports why.
 */

import { env } from './env';
import { getConfigOrNull } from './config';

let warnedLocked = false;

/**
 * The prefix to put in front of `/api/image/…` and `/api/video/…`, or `''`
 * to keep them relative. Evaluated per call, because the site password can be
 * switched on from the admin panel without a restart.
 */
export function cdnBase(): string {
  const base = env.CDN_URL;
  if (!base) return '';

  let locked: boolean;
  try {
    locked = !!getConfigOrNull()?.sitePassword;
  } catch {
    // An unreadable config renders the setup screen; no image URLs are made.
    locked = true;
  }

  if (locked) {
    if (!warnedLocked) {
      warnedLocked = true;
      console.warn(
        '[CDN] CDN_URL is set, but the site is password-protected — serving photos from this ' +
          'server so the password keeps covering them.',
      );
    }
    return '';
  }
  return base;
}

/**
 * The CDN's origin, for the Content-Security-Policy's `img-src` and
 * `media-src`. Independent of the site password: allowing an origin the page
 * happens not to use costs nothing, and the proxy that builds the policy runs
 * before the config is consulted.
 */
export function cdnOrigin(): string | null {
  return env.CDN_URL ? new URL(env.CDN_URL).origin : null;
}
