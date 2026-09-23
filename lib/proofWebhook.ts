/**
 * Tell the photographer that a client submitted a proofing selection.
 *
 * One POST to `PROOFING_WEBHOOK_URL` with a JSON body shaped to be useful to
 * as many receivers as possible without a per-service setting: Discord reads
 * `content`, Slack and Mattermost read `text`, Gotify reads `title` and
 * `message`, and n8n, Home Assistant or a script of your own get the
 * structured `proofing` object.
 *
 * Fire-and-forget by design. A webhook that is down must never turn a client's
 * submit into an error — the selection is already saved and visible in the
 * admin panel — so failures are logged and swallowed, and the request is
 * bounded by a short timeout.
 */

import type { ProofSession } from './proofSessions';

const WEBHOOK_TIMEOUT_MS = 5000;

export interface ProofWebhookPayload {
  event: 'proofing.submitted';
  title: string;
  message: string;
  text: string;
  content: string;
  proofing: {
    id: string;
    clientName: string;
    albumId: string;
    albumName: string;
    selected: number;
    submittedAt: string;
    /** The admin page for this session, when a site URL is configured. */
    adminUrl: string | null;
  };
}

export function buildWebhookPayload(
  session: ProofSession,
  albumName: string,
  siteUrl: string | null,
): ProofWebhookPayload {
  const count = session.selection.length;
  const title = `Proofing: ${session.clientName} submitted a selection`;
  const adminUrl = siteUrl ? `${siteUrl}/admin/proofing?session=${session.id}` : null;
  const message =
    `${session.clientName} picked ${count} ${count === 1 ? 'photo' : 'photos'} from "${albumName}".` +
    (adminUrl ? ` ${adminUrl}` : '');
  return {
    event: 'proofing.submitted',
    title,
    message,
    text: `${title}\n${message}`,
    content: `**${title}**\n${message}`,
    proofing: {
      id: session.id,
      clientName: session.clientName,
      albumId: session.albumId,
      albumName,
      selected: count,
      submittedAt: session.submittedAt ?? new Date().toISOString(),
      adminUrl,
    },
  };
}

/** Parse PROOFING_WEBHOOK_URL; anything that is not an http(s) URL is ignored. */
export function webhookUrl(raw = process.env.PROOFING_WEBHOOK_URL): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function notifySubmitted(
  session: ProofSession,
  albumName: string,
  siteUrl: string | null,
): Promise<void> {
  const url = webhookUrl();
  if (!url) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWebhookPayload(session, albumName, siteUrl)),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[Proofing] Webhook answered ${res.status}; the selection is saved regardless.`);
    }
  } catch (err) {
    console.warn(
      '[Proofing] Webhook failed; the selection is saved regardless:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    clearTimeout(timer);
  }
}
