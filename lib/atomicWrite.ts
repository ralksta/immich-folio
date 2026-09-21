import fs from 'fs/promises';

/**
 * Monotonic within the process, so two writes to the same path started in the
 * same millisecond cannot land on the same temp file. Several of the copies
 * this replaces used `Date.now()`, which can.
 */
let tmpCounter = 0;

/**
 * Write a file atomically: unique temp file, then rename.
 *
 * The rename is what makes this atomic; the temp filename is what did not.
 * With a constant `${filePath}.tmp`, two saves of the same file in flight at
 * once shared it — the second writeFile could interleave with the first's
 * rename, leaving one save's bytes published under the other's, or a truncated
 * mix. A double-clicked Save in the page builder is enough.
 *
 * Readers matter as much as writers: `GET /api/favicon` reads its file on every
 * request, so a plain writeFile would let a concurrent read see a half-written
 * icon.
 *
 * No encoding is passed. `fs.writeFile` defaults to utf8 for a string and
 * writes a Buffer verbatim, which is what every caller wants — the copies this
 * replaces variously said `'utf8'`, `'utf-8'` or nothing at all.
 *
 * Creating the directory is the caller's business; this only writes the file.
 */
export async function atomicWrite(filePath: string, content: string | Buffer): Promise<void> {
  const tmpPath = `${filePath}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    await fs.writeFile(tmpPath, content);
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Do not leave litter behind a failed save. Cleanup failure is not worth
    // masking the real error with.
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}
