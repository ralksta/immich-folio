import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';

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

export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filePath = path.join(CONTENT_DIR, FILENAME);
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

  const filePath = path.join(CONTENT_DIR, FILENAME);

  // ── Backup existing file ────────────────────────────────────
  try {
    await fs.access(filePath);
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
  } catch {
    // File doesn't exist yet — no backup needed, but make sure the dir exists
    await fs.mkdir(CONTENT_DIR, { recursive: true });
  }

  // ── Atomic write (temp file + rename) ───────────────────────
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }

  revalidatePath('/about', 'layout');

  return NextResponse.json({ success: true, message: 'About page saved.' });
}
