/**
 * Per-file memo for the journal and page listings.
 *
 * `listJournalEntries()` and `listPages()` run on every public page render —
 * the header nav asks whether a journal exists and which pages to link — and
 * used to read and parse every markdown file each time. The parse is the
 * expensive part and depends only on the file's bytes, so it is kept here,
 * keyed on the file's identity and stamp: inode, size and mtime in
 * nanoseconds.
 *
 * An admin save goes through atomicWrite (temp file + rename), which always
 * produces a new inode, so a save is seen by the very next listing, in this
 * module instance or any other. An edit in place changes mtime. The stat is
 * taken before the read, so a write landing between the two at worst stores
 * the new bytes under the old stamp — which the next stat no longer matches,
 * so the file is simply read again. Stale bytes under a current stamp cannot
 * happen.
 *
 * Values are handed out as copies: a caller that mutates an entry must not
 * change what the next request sees.
 */

import fs from 'fs/promises';

interface Cached<T> {
  stamp: string;
  value: T;
}

export class ParsedFileCache<T> {
  private readonly entries = new Map<string, Cached<T>>();

  constructor(private readonly parse: (raw: string) => T) {}

  /**
   * Parsed contents of `filePath`, from the memo when the file is unchanged.
   * Throws like `fs.readFile` for a missing or unreadable file, and like
   * `parse` for one that does not parse — neither outcome is cached.
   */
  async read(filePath: string): Promise<T> {
    const st = await fs.stat(filePath, { bigint: true });
    const stamp = `${st.ino}:${st.size}:${st.mtimeNs}`;
    const hit = this.entries.get(filePath);
    if (hit && hit.stamp === stamp) return structuredClone(hit.value);

    const value = this.parse(await fs.readFile(filePath, 'utf8'));
    this.entries.set(filePath, { stamp, value });
    return structuredClone(value);
  }

  /** Drop entries for files a listing no longer found, so deletes do not pile up. */
  retain(filePaths: Set<string>): void {
    for (const key of this.entries.keys()) {
      if (!filePaths.has(key)) this.entries.delete(key);
    }
  }
}
