import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { readGalleryYaml, writeGalleryYaml } from '@/lib/admin/yaml-service';
import { invalidateConfigCache } from '@/lib/config';
import { immich } from '@/lib/immich';
import type { GalleryYaml } from '@/lib/config/schema';

/** GET: Read current gallery.yaml config. */
export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gallery = await readGalleryYaml();
  return NextResponse.json({ gallery: gallery || { hero: [], albums: [], subpages: [] } });
}

/** PUT: Write gallery.yaml config. */
export async function PUT(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.gallery) {
    return NextResponse.json({ error: 'Missing gallery data' }, { status: 400 });
  }

  // Validate basic structure
  const gallery = body.gallery as GalleryYaml;
  if (!Array.isArray(gallery.hero) && typeof gallery.hero !== 'string' && gallery.hero != null) {
    return NextResponse.json({ error: 'Invalid hero format' }, { status: 400 });
  }

  try {
    await writeGalleryYaml(gallery);
    invalidateConfigCache();
    immich.invalidateAll();
    // Revalidate all pages so the homepage picks up new hero images immediately
    revalidatePath('/', 'layout');
    return NextResponse.json({ success: true, message: 'Saved successfully. Backup of previous version created.' });
  } catch (err) {
    console.error('[Admin] Failed to write gallery.yaml:', err);
    return NextResponse.json({ error: 'Failed to save gallery config' }, { status: 500 });
  }
}
