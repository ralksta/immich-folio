/**
 * Webhook endpoint — receives album update events from Immich and
 * invalidates the corresponding in-memory cache entries.
 *
 * Security: requests must include an HMAC-SHA256 signature in the
 * `x-immich-signature` header, computed as:
 *
 *   HMAC-SHA256(WEBHOOK_SECRET, raw request body)
 *
 * If WEBHOOK_SECRET is not set, the endpoint returns 501.
 *
 * Supported Immich event types:
 *   - album.updated      → invalidates the specific album
 *   - album.assetAdded   → invalidates the specific album
 *   - album.assetRemoved → invalidates the specific album
 *   - *                  → any other event clears the full cache
 *
 * POST /api/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { immich } from '@/lib/immich';
import { env } from '@/lib/env';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Tight rate limit — webhooks should come from one trusted source only
const WEBHOOK_RPM = 60;

/** Album-scoped Immich webhook events. */
const ALBUM_EVENTS = new Set(['album.updated', 'album.assetAdded', 'album.assetRemoved']);

export async function POST(request: NextRequest) {
  // ── Feature guard ──────────────────────────────────
  if (!env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Webhook is not configured. Set WEBHOOK_SECRET in your environment.' },
      { status: 501 },
    );
  }

  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const { success } = checkRateLimit(`webhook:${ip}`, WEBHOOK_RPM);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // ── Read body (needed for HMAC verification) ───────
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // ── Signature verification ─────────────────────────
  const signature = request.headers.get('x-immich-signature');
  if (!signature) {
    console.warn('[Webhook] ⚠️ Missing x-immich-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(rawBody).digest('hex');

  let signatureValid = false;
  try {
    signatureValid = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // Buffer lengths differ → invalid hex or wrong length
    signatureValid = false;
  }

  if (!signatureValid) {
    console.warn(`[Webhook] ⚠️ Invalid signature from ${ip}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ── Parse payload ──────────────────────────────────
  let payload: { event?: string; albumId?: string } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { event, albumId } = payload;

  if (!event) {
    return NextResponse.json({ error: 'Missing event field in payload' }, { status: 400 });
  }

  // ── Cache invalidation ─────────────────────────────
  if (ALBUM_EVENTS.has(event) && albumId && typeof albumId === 'string') {
    immich.invalidateAlbum(albumId);
    return NextResponse.json({ ok: true, invalidated: albumId });
  }

  // Any unrecognised event → full cache clear
  immich.invalidateAll();
  return NextResponse.json({ ok: true, invalidated: 'all' });
}
