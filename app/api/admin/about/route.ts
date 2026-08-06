import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';

const CONTENT_DIR = path.resolve(process.cwd(), 'content');

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

export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filePath = path.join(CONTENT_DIR, 'about.md');
  let meta: AboutMeta = {};
  let body = '';

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
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

  return NextResponse.json({ meta, body });
}

export async function PUT(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const filePath = path.join(CONTENT_DIR, 'about.md');
  await fs.writeFile(filePath, content, 'utf-8');

  revalidatePath('/about', 'layout');

  return NextResponse.json({ success: true, message: 'About page saved.' });
}
