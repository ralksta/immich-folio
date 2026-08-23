/**
 * In-memory sliding-window rate limiter.
 * Tracks request counts per IP per minute bucket.
 * Auto-evicts expired entries to prevent memory leaks.
 *
 * ⚠️ NOTE: This is an in-memory store. In a multi-node or serverless
 * environment (Vercel, AWS Lambda, Docker Swarm), each instance will
 * have its own independent rate limit. For a global limit across
 * multiple nodes, a persistent store like Redis would be required.
 */

import { NextRequest } from 'next/server';
import { env } from './env';

/** Bucket key used when the client cannot be identified with any confidence. */
const UNIDENTIFIED = 'unknown';

let warnedUnidentified = false;

/**
 * Falling back to the shared bucket is the *correct* behaviour — the
 * alternative is trusting a spoofable header — but it is silent, and silence is
 * the problem. Every unidentified request shares one bucket per endpoint, and
 * this is an image proxy: a single 50-photo grid issues ~50 `/api/image`
 * requests, so the default 1500 rpm is collectively spent by roughly 30 page
 * loads a minute. Visitors then see 429s with nothing in the log pointing at
 * the proxy configuration that caused it.
 *
 * Warn once per process: enough to diagnose, not enough to flood the log.
 */
function unidentified(hops: number, detail: string): string {
  if (!warnedUnidentified) {
    warnedUnidentified = true;
    console.warn(
      `\n⚠️  Rate limiting cannot identify clients: ${detail}\n` +
        `   TRUSTED_PROXY_HOPS is ${hops}, so the client IP is read ${hops} entr${hops === 1 ? 'y' : 'ies'} from the\n` +
        `   right of X-Forwarded-For. Unidentified requests all share ONE bucket per\n` +
        `   endpoint, which an image proxy exhausts quickly — expect 429s for everyone.\n` +
        `   Set TRUSTED_PROXY_HOPS to the number of proxies actually in front of the app\n` +
        `   (nginx/Traefik/Caddy = 1; add 1 for each additional layer, e.g. Cloudflare = 2).\n`,
    );
  }
  return UNIDENTIFIED;
}

/** Test seam: the warning is once-per-process, which tests need to re-arm. */
export function __resetProxyWarningForTests(): void {
  warnedUnidentified = false;
}

/**
 * Resolve the client IP to use as a rate-limit bucket key.
 *
 * Self-hosted Next.js cannot see the socket peer address (`request.ip` is only
 * populated by platforms like Vercel), so behind a reverse proxy the client IP
 * has to come from a header. Headers are attacker-controlled unless a proxy
 * overwrites them, which is what TRUSTED_PROXY_HOPS declares.
 *
 * With `TRUSTED_PROXY_HOPS=n`, the entry `n` from the *right* of
 * X-Forwarded-For is used. Proxies append the address they actually saw
 * (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`), so
 * everything to the left is client-supplied and ignored. A client that sends
 * `X-Forwarded-For: 1.1.1.1` therefore cannot pick its own bucket.
 *
 * ⚠️ This holds only while the app is reachable *exclusively* through the
 * proxy. Bind the server to localhost — if clients can connect directly they
 * control the whole header and no parsing strategy can help.
 */
export function getClientIp(request: NextRequest): string {
  // Read straight from the environment rather than through getConfig(): the
  // config parses gallery.yaml and resolves AUTH_SECRET, which throws in
  // production when neither an env var nor install.json carries one. That made
  // every rate-limited route — including the install wizard's own API, whose
  // job is to *create* that secret — answer 500 on a container started with no
  // environment at all (#519). Rate limiting has no business depending on
  // whether the site's content config can be read.
  const hops = env.TRUSTED_PROXY_HOPS;

  // @ts-expect-error - Next.js 15+ removed request.ip from types but hosting platforms still populate it
  const directIp = request.ip as string | undefined;
  // The real socket peer address, where available, is never spoofable.
  if (directIp) return directIp;

  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIp = request.headers.get('x-real-ip');

  if (hops > 0) {
    if (xForwardedFor) {
      const chain = xForwardedFor
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // Chain shorter than the configured hop count means the request did not
      // traverse the full proxy chain — do not fall back to a spoofable entry.
      const ip = chain[chain.length - hops];
      if (ip) return ip;

      return unidentified(
        hops,
        `X-Forwarded-For carries ${chain.length} entr${chain.length === 1 ? 'y' : 'ies'}, ` +
          `fewer than the ${hops} configured hop${hops === 1 ? '' : 's'}`,
      );
    }
    // nginx's `proxy_set_header X-Real-IP $remote_addr` overwrites rather than
    // appends, so it is trustworthy — but only for a single hop, since an outer
    // proxy would leave an inner proxy's value in place.
    if (xRealIp && hops === 1) return xRealIp;

    return unidentified(
      hops,
      xRealIp
        ? 'no X-Forwarded-For header, and X-Real-IP is only trustworthy at a single hop'
        : 'neither X-Forwarded-For nor X-Real-IP was present',
    );
  }

  // No proxy declared: headers are best-effort only. This still separates
  // honest clients into their own buckets, but a deliberate attacker can spoof
  // them. Set TRUSTED_PROXY_HOPS if you run behind a reverse proxy.
  return xRealIp ?? xForwardedFor?.split(',')[0].trim() ?? UNIDENTIFIED;
}

/**
 * Seconds a client should wait before retrying, for the `Retry-After` header.
 *
 * Floored at 1. The obvious `Math.ceil((resetAt - Date.now()) / 1000)` yields 0
 * — or a negative number — when the window is on the point of expiring, and
 * `Retry-After: 0` tells the client to retry immediately, which is the opposite
 * of what a 429 is for. A negative value is not valid HTTP at all.
 */
export function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Hard ceiling to prevent unbounded memory growth under DDoS conditions
const MAX_STORE_ENTRIES = 10_000;

// Evict expired entries periodically (every 60s)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}

/**
 * Check if a request should be allowed.
 * @param ip - Client IP address
 * @param maxRpm - Maximum requests per minute
 * @returns { success, remaining, resetAt (epoch ms) }
 */
export function checkRateLimit(
  ip: string,
  maxRpm: number,
): { success: boolean; remaining: number; resetAt: number } {
  cleanup();

  const now = Date.now();
  const windowMs = 60_000;
  const key = `rl:${ip}`;

  const entry = store.get(key);

  // New window or expired
  if (!entry || now > entry.expiresAt) {
    if (store.size >= MAX_STORE_ENTRIES) {
      // Store is full. Evict the oldest entry to prevent cache flooding
      // DOS attacks, which could otherwise block all legitimate users.
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) {
        store.delete(oldestKey);
      }
    }
    const resetAt = now + windowMs;
    store.set(key, { count: 1, expiresAt: resetAt });
    return { success: true, remaining: maxRpm - 1, resetAt };
  }

  // Within window
  entry.count++;
  if (entry.count > maxRpm) {
    return { success: false, remaining: 0, resetAt: entry.expiresAt };
  }

  return { success: true, remaining: maxRpm - entry.count, resetAt: entry.expiresAt };
}
