import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { withAdmin } from '@/lib/admin/withAdmin';
import { atomicWrite } from '@/lib/atomicWrite';
import {
  VersionConflictError,
  assertVersion,
  baseVersionFrom,
  conflictResponse,
  etag,
  fileVersion,
  serializeContentWrite,
  versionOf,
} from '@/lib/admin/contentVersion';
import { getConfig } from '@/lib/config';
import { env } from '@/lib/env';
import { PRIVACY_FILENAME, processingFacts, readPrivacy, starterHeadings } from '@/lib/privacy';

const CONTENT_DIR = path.resolve(process.cwd(), 'content');
const MAX_BACKUPS = 10;
/** Far beyond any real policy; keeps a runaway paste out of the content volume. */
const MAX_LENGTH = 200_000;

/**
 * The privacy policy (#699). GET also returns what this installation
 * processes (lib/privacy.ts), which the editor shows next to the text.
 */
export const GET = withAdmin(async () => {
  const config = getConfig();
  const facts = processingFacts(config, {
    CDN_URL: env.CDN_URL,
    hasPasswords:
      !!config.sitePassword ||
      config.subpages.some((sp) => !!sp.password) ||
      Object.values(config.albumPasswords).some(Boolean),
  });
  // Read before the text: a save landing between the two then makes the
  // version stale, which costs a spurious conflict, never a missed one.
  const version = await fileVersion(path.join(CONTENT_DIR, PRIVACY_FILENAME));
  return NextResponse.json(
    {
      body: readPrivacy(CONTENT_DIR),
      // Sent back in If-Match on save (#601).
      version,
      enabled: config.privacy.enabled,
      facts,
      starter: starterHeadings(config.lang, facts),
    },
    { headers: { 'Cache-Control': 'no-store', ETag: etag(version) } },
  );
});

/** PUT { body } — writes content/privacy.md, keeping a backup like about.md. */
export const PUT = withAdmin(async (request: Request) => {
  const data = (await request.json().catch(() => null)) as { body?: unknown } | null;
  if (!data || typeof data.body !== 'string' || data.body.length > MAX_LENGTH) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const filePath = path.join(CONTENT_DIR, PRIVACY_FILENAME);
  const body = data.body.trim();
  const content = body ? `${body}\n` : '';
  const baseVersion = baseVersionFrom(request);
  try {
    await serializeContentWrite(async () => {
      await assertVersion(filePath, baseVersion);
      await fs.mkdir(CONTENT_DIR, { recursive: true });

      // Same rule as the about route (#630): only a missing file means there is
      // nothing to back up. Any other failure aborts before the live file changes.
      let fileExists = true;
      try {
        await fs.access(filePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        fileExists = false;
      }

      if (fileExists) {
        const backupDir = path.join(CONTENT_DIR, '.backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await fs.copyFile(filePath, path.join(backupDir, `${PRIVACY_FILENAME}.${timestamp}.bak`));
        const backups = (await fs.readdir(backupDir))
          .filter((e) => e.startsWith(PRIVACY_FILENAME) && e.endsWith('.bak'))
          .sort();
        while (backups.length > MAX_BACKUPS) {
          await fs.unlink(path.join(backupDir, backups.shift()!));
        }
      }

      await atomicWrite(filePath, content);
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflictResponse(err.currentVersion);
    throw err;
  }
  revalidatePath('/', 'layout');

  return NextResponse.json({
    success: true,
    message: 'Privacy policy saved.',
    version: versionOf(content),
  });
});
