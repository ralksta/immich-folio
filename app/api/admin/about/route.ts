import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { readAboutFile, writeAboutFile, type AboutContent } from '@/lib/admin/about-service';
import { isUuid } from '@/lib/uuid';

/** GET: Read the current about.md content. */
export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const about = await readAboutFile();
    return NextResponse.json({ about });
  } catch (err) {
    console.error('[Admin API] Failed to read about.md:', err);
    return NextResponse.json({ error: 'Failed to read about content' }, { status: 500 });
  }
}

/** PUT: Write about.md. */
export async function PUT(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.about !== 'object' || body.about === null) {
    return NextResponse.json({ error: 'Missing about data' }, { status: 400 });
  }

  const raw = body.about as Record<string, unknown>;
  const about: AboutContent = {
    portrait: typeof raw.portrait === 'string' && raw.portrait ? raw.portrait : undefined,
    name: typeof raw.name === 'string' && raw.name ? raw.name : undefined,
    location: typeof raw.location === 'string' && raw.location ? raw.location : undefined,
    gear: Array.isArray(raw.gear)
      ? raw.gear.filter((item): item is string => typeof item === 'string' && !!item)
      : undefined,
    body: typeof raw.body === 'string' ? raw.body : '',
    enabled: raw.enabled === false ? false : true,
  };

  if (about.portrait && !isUuid(about.portrait)) {
    return NextResponse.json({ error: 'Invalid portrait asset ID' }, { status: 400 });
  }

  try {
    await writeAboutFile(about);
    revalidatePath('/about', 'page');
    revalidatePath('/', 'layout');
    return NextResponse.json({
      success: true,
      message: 'Saved successfully. Backup of previous version created.',
    });
  } catch (err) {
    console.error('[Admin API] Failed to write about.md:', err);
    return NextResponse.json({ error: 'Failed to save about content' }, { status: 500 });
  }
}
