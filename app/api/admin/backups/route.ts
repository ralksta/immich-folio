import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { revalidatePath } from 'next/cache';
import { listBackups, restoreBackup } from '@/lib/admin/yaml-service';
import { listJournalBackups, restoreJournalBackup } from '@/lib/admin/journal-service';
import { invalidateConfigCache } from '@/lib/config';
import { immich } from '@/lib/immich';

export type BackupTarget = 'gallery' | 'settings' | 'about' | 'journal';

export interface BackupItem {
  filename: string;
  target: BackupTarget;
  timestamp: string | null;
  isPreRestore: boolean;
  /** Journal backups only: the entry the backup belongs to. */
  slug?: string;
  /** Journal backups only: the snapshot taken when the entry was deleted. */
  isDeleted?: boolean;
}

function parseBackupInfo(filename: string, target: BackupTarget): BackupItem {
  const isPreRestore = filename.includes('pre-restore');

  // Extract timestamp from filename like filename.2026-05-31T17-30-00-000Z.bak
  const match = filename.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/);
  let timestamp: string | null = null;
  if (match) {
    // Reconstruct valid ISO string: 2026-05-31T17:30:00.000Z
    const parts = match[0].split('T');
    const datePart = parts[0];
    const timeParts = parts[1].replace('Z', '').split('-');
    if (timeParts.length >= 4) {
      timestamp = `${datePart}T${timeParts[0]}:${timeParts[1]}:${timeParts[2]}.${timeParts[3]}Z`;
    }
  }

  return {
    filename,
    target,
    timestamp,
    isPreRestore,
  };
}

/** GET: List all available backups, grouped by the file they restore. */
export const GET = withAdmin(async () => {
  try {
    const gallery = (await listBackups('gallery.yaml')).map((f) => parseBackupInfo(f, 'gallery'));
    const settings = (await listBackups('settings.yaml')).map((f) =>
      parseBackupInfo(f, 'settings'),
    );
    const about = (await listBackups('about.md')).map((f) => parseBackupInfo(f, 'about'));
    // Newest first across all entries, so a just-deleted entry sits on top.
    const journal = (await listJournalBackups())
      .map((b) => ({
        ...parseBackupInfo(b.filename, 'journal'),
        slug: b.slug,
        isDeleted: b.kind === 'deleted',
      }))
      .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));

    return NextResponse.json({
      backups: {
        gallery,
        settings,
        about,
        journal,
      },
    });
  } catch (err) {
    console.error('[Admin API] Error listing backups:', err);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
});

/** POST: Restore a specific backup file. */
export const POST = withAdmin(async (req: Request) => {
  try {
    const body = await req.json();
    const { backupFilename, target } = body || {};

    if (!backupFilename || typeof backupFilename !== 'string') {
      return NextResponse.json({ error: 'backupFilename is required' }, { status: 400 });
    }

    // Security check: prevent directory traversal
    if (
      backupFilename.includes('..') ||
      backupFilename.includes('/') ||
      backupFilename.includes('\\')
    ) {
      return NextResponse.json({ error: 'Invalid backup filename' }, { status: 400 });
    }

    if (!backupFilename.endsWith('.bak')) {
      return NextResponse.json({ error: 'Invalid backup file extension' }, { status: 400 });
    }

    // Journal backups live in their own directory, and `<slug>.md.<ts>.bak`
    // cannot be told apart from an about.md backup by name alone.
    if (target === 'journal') {
      await restoreJournalBackup(backupFilename);
    } else {
      await restoreBackup(backupFilename);
    }

    // Invalidate caches & revalidate pages
    invalidateConfigCache();
    immich.invalidateAll();
    revalidatePath('/', 'layout');

    return NextResponse.json({
      success: true,
      message: `Successfully restored ${backupFilename}`,
    });
  } catch (err) {
    console.error('[Admin API] Error restoring backup:', err);
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
  }
});
