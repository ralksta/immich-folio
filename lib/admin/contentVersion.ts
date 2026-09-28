/**
 * Concurrent-edit detection for the admin's content files (#601).
 *
 * Every editor holds a full snapshot of the file it edits and PUTs all of it,
 * so without a check the tab that saves second silently reverts whatever the
 * first one changed — as does a panel left open across a hand edit or a backup
 * restore. Each GET therefore hands out a version of the file it read, the PUT
 * sends it back in `If-Match`, and the write is refused with 409 when the file
 * on disk is no longer that version.
 *
 * The version is a hash of the bytes, not the mtime: the mtime has a
 * resolution the filesystem chooses (a second on some), survives a copy that
 * changes the content (`cp -p`, a restore from a backup of equal age) and
 * changes on a `touch` that does not. The files are small, so hashing one per
 * save costs nothing that matters.
 *
 * A PUT without `If-Match` is written as before. That keeps an older admin tab
 * (loaded before the upgrade) and scripts working, and the check is a guard
 * against accidents, not an access control: an operator who wants to overwrite
 * can always reload and save. `If-Match: *` means the same — write regardless.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { NextResponse } from 'next/server';

/** The version of a file that does not exist. A save expecting it creates the file. */
export const ABSENT_VERSION = 'absent';

/**
 * Version of some content; null content means "no file". A string is hashed
 * as its UTF-8 bytes, which is what a save writes — so it fits content about
 * to be written, not text decoded from a file (see readVersioned).
 */
export function versionOf(content: string | Buffer | null): string {
  if (content === null) return ABSENT_VERSION;
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
}

/**
 * Read a text file together with the version of its bytes, for an editor's
 * GET. The version has to come from the bytes, never from the decoded text:
 * a file that is not valid UTF-8 (a Latin-1 "Über" from a hand edit) decodes
 * lossily, the text re-encodes to other bytes, and a version taken from it
 * would never equal what `fileVersion()` computes at save time — every save
 * of that file would be refused as a conflict. Throws ENOENT like readFile.
 */
export async function readVersioned(filePath: string): Promise<{ text: string; version: string }> {
  const bytes = await fs.readFile(filePath);
  return { text: bytes.toString('utf8'), version: versionOf(bytes) };
}

/** Version of the file at `filePath` as it is on disk now. */
export async function fileVersion(filePath: string): Promise<string> {
  try {
    return versionOf(await fs.readFile(filePath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ABSENT_VERSION;
    throw err;
  }
}

/** The file changed on disk since the editor loaded it. */
export class VersionConflictError extends Error {
  constructor(readonly currentVersion: string) {
    super('The file was changed elsewhere since it was loaded.');
    this.name = 'VersionConflictError';
  }
}

/**
 * Throw a VersionConflictError when `filePath` is not at `baseVersion`.
 * An undefined base version (no `If-Match`) skips the check.
 */
export async function assertVersion(
  filePath: string,
  baseVersion: string | undefined,
): Promise<void> {
  if (baseVersion === undefined) return;
  const current = await fileVersion(filePath);
  if (current !== baseVersion) throw new VersionConflictError(current);
}

/**
 * The base version a PUT sent, or undefined for "no check". Accepts the
 * quoted ETag form (`"abc"`, `W/"abc"`) as well as a bare token; `*` and an
 * empty header mean no check.
 */
export function baseVersionFrom(request: Request): string | undefined {
  const raw = request.headers.get('if-match')?.trim();
  if (!raw || raw === '*') return undefined;
  return raw.replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}

/** The header form of a version. */
export function etag(version: string): string {
  return `"${version}"`;
}

/** The 409 every content route answers a stale save with. */
export function conflictResponse(currentVersion: string): NextResponse {
  return NextResponse.json(
    {
      error: 'This was changed elsewhere since you opened it.',
      conflict: true,
      version: currentVersion,
    },
    { status: 409, headers: { ETag: etag(currentVersion) } },
  );
}

/**
 * Run content writes one at a time within this process.
 *
 * The version check and the write it guards must not interleave with another
 * save, or two tabs saving in the same instant would both pass the check. A
 * single queue for all content files is enough — admin saves are rare and
 * short — and it also serialises a rename's write-then-delete. Like the rate
 * limiter it is per process; Folio runs as one.
 */
let queue: Promise<unknown> = Promise.resolve();

export function serializeContentWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}
