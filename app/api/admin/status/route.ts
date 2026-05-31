import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { immich } from '@/lib/immich';
import { cache } from '@/lib/cache';
import { listBackups, readGalleryYaml, readSettingsYaml } from '@/lib/admin/yaml-service';

export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Immich Connection Status
  let immichOk = false;
  try {
    immichOk = await immich.ping();
  } catch (err) {
    console.error('[Admin API] Immich ping failed:', err);
  }

  // 2. Config Health Check
  let galleryValid = false;
  let settingsValid = false;
  try {
    const gallery = await readGalleryYaml();
    galleryValid = !!gallery;
  } catch (err) {
    console.error('[Admin API] Gallery YAML parse failed:', err);
  }

  try {
    const settings = await readSettingsYaml();
    settingsValid = !!settings;
  } catch (err) {
    console.error('[Admin API] Settings YAML parse failed:', err);
  }

  // 3. Backup Info
  const galleryBackups = await listBackups('gallery.yaml');
  const settingsBackups = await listBackups('settings.yaml');
  const backupCount = galleryBackups.length + settingsBackups.length;
  
  // Find timestamp of the latest backup
  let lastBackup: string | null = null;
  const allBackups = [...galleryBackups, ...settingsBackups].sort().reverse();
  if (allBackups.length > 0) {
    // Filename format: filename.yaml.2026-05-31T17-30-00-000Z.bak
    const match = allBackups[0].match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    if (match) {
      lastBackup = match[0].replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})T/, '$1-$2-$3T');
    } else {
      lastBackup = allBackups[0]; // fallback
    }
  }

  return NextResponse.json({
    immich: {
      status: immichOk ? 'connected' : 'disconnected',
    },
    config: {
      status: (galleryValid && settingsValid) ? 'valid' : 'invalid',
      gallery: galleryValid ? 'valid' : 'invalid',
      settings: settingsValid ? 'valid' : 'invalid',
    },
    cache: {
      size: cache.size,
    },
    backups: {
      count: backupCount,
      lastBackup,
    },
  });
}
