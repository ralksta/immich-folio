import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { atomicWrite } from '@/lib/atomicWrite';
import {
  needsBackup,
  VersionConflictError,
  assertVersion,
  baseVersionFrom,
  conflictResponse,
  etag,
  readVersioned,
  serializeContentWrite,
  versionOf,
} from '@/lib/admin/contentVersion';

const CONTENT_DIR = path.resolve(process.cwd(), 'content');
const FILENAME = 'about.md';
const MAX_BACKUPS = 10;

interface AboutMeta {
  portrait?: string;
  name?: string;
  location?: string;
  gear?: string[];
}

interface AboutBody {
  meta?: AboutMeta;
  body?: string;
}

export const GET = withAdmin(async () => {
  const filePath = path.join(CONTENT_DIR, FILENAME);
  let meta: AboutMeta = {};
  let body = '';
  let version = versionOf(null);

  try {
    // The version comes from the bytes read, not the decoded text (#601).
    const read = await readVersioned(filePath);
    version = read.version;
    const raw = read.text;
    const match = raw.match(/^(?:---\r?\n)([\s\S]*?)(?:\r?\n---\r?\n)([\s\S]*)$/);
    if (match) {
      try {
        meta = (yaml.load(match[1]) || {}) as AboutMeta;
      } catch (e) {
        console.error('[Admin] Failed to parse about.md frontmatter', e);
      }
      body = match[2].trim();
    }
  } catch {
    // File doesn't exist yet — return empty defaults
  }

  // `version` goes back in If-Match on save (#601).
  return NextResponse.json({ meta, body, version }, { headers: { ETag: etag(version) } });
});

export const PUT = withAdmin(async (request: Request) => {
  const data = (await request.json().catch(() => null)) as AboutBody | null;
  if (!data) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const meta = data.meta ?? {};

  // Clean up empty values
  for (const [k, v] of Object.entries(meta)) {
    if (v === '' || v === undefined) delete meta[k as keyof AboutMeta];
  }
  if (meta.gear && meta.gear.length === 0) delete meta.gear;

  const cleanMeta: Record<string, unknown> = { ...meta };
  const frontmatter = yaml.dump(cleanMeta, { lineWidth: -1, noRefs: true }).trim();
  const content = `---\n${frontmatter}\n---\n\n${data.body ?? ''}\n`;

  const filePath = path.join(CONTENT_DIR, FILENAME);
  const baseVersion = baseVersionFrom(request);
  try {
    await serializeContentWrite(async () => {
      await assertVersion(filePath, baseVersion);
      await fs.mkdir(CONTENT_DIR, { recursive: true });

      // "No file yet" and "the backup could not be written" used to share one
      // catch, so a `.backups/` this save couldn't write to looked exactly like a
      // brand-new file: the save went ahead with no snapshot taken (#630). Only
      // ENOENT means there is nothing to back up; anything else aborts the save
      // before it overwrites the live file.
      // A save that changes nothing takes no backup either (needsBackup).
      if (await needsBackup(filePath, content)) {
        const backupDir = path.join(CONTENT_DIR, '.backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await fs.copyFile(filePath, path.join(backupDir, `${FILENAME}.${timestamp}.bak`));

        // Prune old backups
        const entries = await fs.readdir(backupDir);
        const aboutBackups = entries
          .filter((e) => e.startsWith(FILENAME) && e.endsWith('.bak'))
          .sort();
        while (aboutBackups.length > MAX_BACKUPS) {
          await fs.unlink(path.join(backupDir, aboutBackups.shift()!));
        }
      }

      await atomicWrite(filePath, content);
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflictResponse(err.currentVersion);
    throw err;
  }

  revalidatePath('/about', 'layout');

  return NextResponse.json({
    success: true,
    message: 'About page saved.',
    version: versionOf(content),
  });
});
