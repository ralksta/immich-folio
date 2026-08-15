import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { listBackups, restoreBackup } from '@/lib/admin/yaml-service';
import { invalidateConfigCache } from '@/lib/config';
import { immich } from '@/lib/immich';

export interface BackupItem {
  filename: string;
  target: 'gallery' | 'settings';
  timestamp: string | null;
  isPreRestore: boolean;
}

function parseBackupInfo(filename: string): BackupItem {
  const target = filename.startsWith('gallery.yaml') ? 'gallery' : 'settings';
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

/** GET: List all available backups for gallery and settings. */
export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const galleryRaw = await listBackups('gallery.yaml');
    const settingsRaw = await listBackups('settings.yaml');

    const gallery = galleryRaw.map(parseBackupInfo);
    const settings = settingsRaw.map(parseBackupInfo);

    return NextResponse.json({
      backups: {
        gallery,
        settings,
      },
    });
  } catch (err) {
    console.error('[Admin API] Error listing backups:', err);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

/** POST: Restore a specific backup file. */
export async function POST(req: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { backupFilename } = body || {};

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

    await restoreBackup(backupFilename);

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
}
