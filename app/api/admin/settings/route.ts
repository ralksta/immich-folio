import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { readSettingsYaml, writeSettingsYaml } from '@/lib/admin/yaml-service';
import { invalidateConfigCache } from '@/lib/config';
import { immich } from '@/lib/immich';
import type { SettingsYaml } from '@/lib/config/schema';

/** GET: Read current settings.yaml config. */
export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await readSettingsYaml();
  return NextResponse.json({ settings: settings || {} });
}

/** PUT: Write settings.yaml config. */
export async function PUT(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.settings) {
    return NextResponse.json({ error: 'Missing settings data' }, { status: 400 });
  }

  const settings = body.settings as SettingsYaml;

  try {
    await writeSettingsYaml(settings);
    invalidateConfigCache();
    immich.invalidateAll();
    revalidatePath('/', 'layout');
    return NextResponse.json({ success: true, message: 'Saved successfully. Backup of previous version created.' });
  } catch (err) {
    console.error('[Admin] Failed to write settings.yaml:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
