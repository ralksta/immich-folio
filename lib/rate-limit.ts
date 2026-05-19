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
import { getConfig } from './config';

export function getClientIp(request: NextRequest): string {
  const config = getConfig();
  // @ts-expect-error - Next.js 15+ removed request.ip from types but hosting platforms still populate it
  const directIp = request.ip as string | undefined;

  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIp = request.headers.get('x-real-ip');

  // If trusted proxies are configured, only trust headers if the request
  // comes from one of those proxies.
  if (config.trustedProxies.length > 0) {
    if (directIp && config.trustedProxies.includes(directIp)) {
      return xRealIp ?? xForwardedFor?.split(',')[0].trim() ?? directIp;
    }
    // If we have trusted proxies but the direct IP is unknown or untrusted,
    // we return the direct IP (if any) and ignore potentially spoofed headers.
    return directIp ?? 'unknown';
  }

  // Fallback for self-hosted environments without explicit trusted proxies:
  // We have to trust headers as a best-effort, but this is vulnerable to spoofing.
  return directIp ?? xRealIp ?? xForwardedFor?.split(',')[0].trim() ?? 'unknown';
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
