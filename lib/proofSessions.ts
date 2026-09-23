/**
 * Client proofing sessions — "Proofing 2.0".
 *
 * The anonymous proofing on public albums keeps everything in the visitor's
 * browser: favourites in localStorage, a bitmask in the URL, and a mailto the
 * photographer may or may not receive. A proofing session is the handover
 * version of that: the photographer creates a link for one client and one
 * album, the client's picks are saved here as they make them, and a final
 * "submit" locks the selection and tells the photographer.
 *
 * Storage is one JSON file, `content/proofing.json`, next to analytics.json —
 * a portfolio has a handful of these at a time, not thousands. The file holds
 * the link tokens, which are capabilities, so it is written 0600.
 *
 * The link token is the only credential a client has. It is 192 random bits,
 * compared as an exact string lookup, and never derived from anything else.
 * Admin routes address a session by its separate, non-secret `id`, so an admin
 * URL in a log or a browser history does not leak a working client link.
 *
 * Selections are stored as Immich asset IDs. Clients only ever see the opaque
 * asset tokens (lib/tokens.ts); the routes decode them and check that every
 * one belongs to the session's album before anything is written.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicWrite } from './atomicWrite';
import { isUuid } from './uuid';

/** What a session lets its client download as a ZIP of originals. */
export type ProofDownload = 'none' | 'selection' | 'album';

export interface ProofSession {
  /** Non-secret handle for the admin panel. */
  id: string;
  /** The client link's capability: /proof/<token>. */
  token: string;
  /** Who the link is for, as the photographer wants to see it. */
  clientName: string;
  albumId: string;
  createdAt: string;
  /** Last day the link works (YYYY-MM-DD, inclusive), or absent for no expiry. */
  expiresOn?: string;
  download: ProofDownload;
  /** How many ZIP downloads the link allows; absent means unlimited. */
  downloadLimit?: number;
  downloadsUsed: number;
  /** Selected Immich asset IDs, in the order the client picked them. */
  selection: string[];
  /** When the client last changed the selection. */
  updatedAt?: string;
  /** Set once the client submits; the selection is read-only from then on. */
  submittedAt?: string;
}

interface ProofStore {
  sessions: ProofSession[];
}

/** The largest selection a session stores — far above any real proofing round. */
export const MAX_SELECTION = 2000;

/** Upper bound on sessions, so a runaway script cannot grow the file forever. */
export const MAX_SESSIONS = 500;

// ── Pure helpers ────────────────────────────────────────────────────

export type ProofState = 'open' | 'submitted' | 'expired';

/**
 * Whether a session still works on `now`. `expiresOn` is inclusive: a link
 * "valid until 12 May" still opens on the evening of 12 May, in the server's
 * time zone.
 */
export function isExpired(session: Pick<ProofSession, 'expiresOn'>, now = new Date()): boolean {
  if (!session.expiresOn) return false;
  const end = new Date(`${session.expiresOn}T23:59:59.999`);
  return Number.isNaN(end.getTime()) ? false : now.getTime() > end.getTime();
}

export function sessionState(session: ProofSession, now = new Date()): ProofState {
  if (isExpired(session, now)) return 'expired';
  return session.submittedAt ? 'submitted' : 'open';
}

/** ZIP downloads left, or null for unlimited. */
export function downloadsRemaining(session: ProofSession): number | null {
  if (session.downloadLimit === undefined) return null;
  return Math.max(0, session.downloadLimit - session.downloadsUsed);
}

/** A 192-bit URL-safe token. */
export function newToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/** Cheap shape check before any file is read for a token from a URL. */
export function isTokenShaped(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** Input the admin panel may send when creating or editing a session. */
export const sessionInputSchema = z.object({
  clientName: z.string().trim().min(1).max(120),
  albumId: z.string().refine(isUuid, 'Not an Immich album ID'),
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  download: z.enum(['none', 'selection', 'album']).default('none'),
  downloadLimit: z.number().int().min(1).max(1000).nullable().optional(),
});

export type SessionInput = z.infer<typeof sessionInputSchema>;

export const sessionPatchSchema = sessionInputSchema
  .omit({ albumId: true })
  .partial()
  .extend({
    /** Unlock a submitted selection so the client can change it again. */
    reopen: z.literal(true).optional(),
    /** Reset the download counter, e.g. after a failed download. */
    resetDownloads: z.literal(true).optional(),
  });

export type SessionPatch = z.infer<typeof sessionPatchSchema>;

// ── Storage ─────────────────────────────────────────────────────────

function storeFile(): string {
  return path.join(process.cwd(), 'content', 'proofing.json');
}

async function readStore(): Promise<ProofStore> {
  let raw: string;
  try {
    raw = await fs.readFile(storeFile(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { sessions: [] };
    throw err;
  }
  // A file that exists but does not parse is not treated as empty: the next
  // write would replace every session with nothing. Let the caller fail.
  const parsed = JSON.parse(raw) as Partial<ProofStore>;
  return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] };
}

/**
 * Serialises read-modify-write within this process, like the analytics store:
 * the atomic rename keeps the file whole, but without the queue two concurrent
 * saves would each write their own copy and one client's heart would vanish.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (store: ProofStore) => T): Promise<T> {
  const run = writeQueue.then(async () => {
    const store = await readStore();
    const result = fn(store);
    await fs.mkdir(path.dirname(storeFile()), { recursive: true });
    await atomicWrite(storeFile(), JSON.stringify(store, null, 2), { mode: 0o600 });
    return result;
  });
  // The queue must survive a failed write, or every later save would reject too.
  writeQueue = run.catch(() => {});
  return run;
}

export async function listSessions(): Promise<ProofSession[]> {
  return (await readStore()).sessions;
}

export async function getSessionById(id: string): Promise<ProofSession | null> {
  return (await readStore()).sessions.find((s) => s.id === id) ?? null;
}

export async function findSessionByToken(token: string): Promise<ProofSession | null> {
  if (!isTokenShaped(token)) return null;
  return (await readStore()).sessions.find((s) => s.token === token) ?? null;
}

export class ProofError extends Error {
  constructor(
    public readonly code: 'not-found' | 'expired' | 'submitted' | 'limit' | 'too-many',
    message: string,
  ) {
    super(message);
  }
}

export async function createSession(input: SessionInput): Promise<ProofSession> {
  return mutate((store) => {
    if (store.sessions.length >= MAX_SESSIONS) {
      throw new ProofError('too-many', `At most ${MAX_SESSIONS} proofing links can exist.`);
    }
    const session: ProofSession = {
      id: crypto.randomBytes(8).toString('hex'),
      token: newToken(),
      clientName: input.clientName,
      albumId: input.albumId,
      createdAt: new Date().toISOString(),
      ...(input.expiresOn ? { expiresOn: input.expiresOn } : {}),
      download: input.download,
      ...(input.downloadLimit ? { downloadLimit: input.downloadLimit } : {}),
      downloadsUsed: 0,
      selection: [],
    };
    store.sessions.push(session);
    return session;
  });
}

export async function updateSession(id: string, patch: SessionPatch): Promise<ProofSession> {
  return mutate((store) => {
    const session = store.sessions.find((s) => s.id === id);
    if (!session) throw new ProofError('not-found', 'No such proofing link.');

    if (patch.clientName !== undefined) session.clientName = patch.clientName;
    if (patch.download !== undefined) session.download = patch.download;
    // `null` clears, `undefined` leaves alone.
    if (patch.expiresOn === null) delete session.expiresOn;
    else if (patch.expiresOn !== undefined) session.expiresOn = patch.expiresOn;
    if (patch.downloadLimit === null) delete session.downloadLimit;
    else if (patch.downloadLimit !== undefined) session.downloadLimit = patch.downloadLimit;
    if (patch.reopen) delete session.submittedAt;
    if (patch.resetDownloads) session.downloadsUsed = 0;
    return session;
  });
}

export async function deleteSession(id: string): Promise<void> {
  await mutate((store) => {
    const before = store.sessions.length;
    store.sessions = store.sessions.filter((s) => s.id !== id);
    if (store.sessions.length === before) {
      throw new ProofError('not-found', 'No such proofing link.');
    }
  });
}

/** Find the session for a token and refuse anything that may not change. */
function openSession(store: ProofStore, token: string): ProofSession {
  const session = isTokenShaped(token) ? store.sessions.find((s) => s.token === token) : undefined;
  if (!session) throw new ProofError('not-found', 'No such proofing link.');
  if (isExpired(session)) throw new ProofError('expired', 'This proofing link has expired.');
  return session;
}

/**
 * Replace the client's selection. The caller has already checked that every ID
 * belongs to the session's album; this re-checks the session's own state inside
 * the write lock, so a save racing a submit cannot slip in after it.
 */
export async function saveSelection(token: string, assetIds: string[]): Promise<ProofSession> {
  return mutate((store) => {
    const session = openSession(store, token);
    if (session.submittedAt) {
      throw new ProofError('submitted', 'This selection has already been submitted.');
    }
    session.selection = Array.from(new Set(assetIds)).slice(0, MAX_SELECTION);
    session.updatedAt = new Date().toISOString();
    return session;
  });
}

/**
 * Lock the selection. Returns the session and whether this call was the one
 * that submitted it, so a double click notifies the photographer only once.
 */
export async function submitSelection(
  token: string,
): Promise<{ session: ProofSession; firstSubmit: boolean }> {
  return mutate((store) => {
    const session = openSession(store, token);
    if (session.submittedAt) return { session, firstSubmit: false };
    session.submittedAt = new Date().toISOString();
    return { session, firstSubmit: true };
  });
}

/** Count one ZIP download against the link's limit, refusing past it. */
export async function claimDownload(token: string): Promise<ProofSession> {
  return mutate((store) => {
    const session = openSession(store, token);
    if (session.download === 'none') {
      throw new ProofError('not-found', 'This proofing link offers no downloads.');
    }
    if (session.downloadLimit !== undefined && session.downloadsUsed >= session.downloadLimit) {
      throw new ProofError('limit', 'The download limit for this link has been reached.');
    }
    session.downloadsUsed += 1;
    return session;
  });
}
