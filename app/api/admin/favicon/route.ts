import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DEST = 'favicon.svg';

const MAX_SIZE = 512 * 1024; // 512 kB

/** Remove stale favicon files left by a previous upload of a different format. */
async function cleanStale() {
  const staleFiles = ['icon.png', 'favicon.ico', 'favicon.jpg'];
  for (const f of staleFiles) {
    try {
      await fs.unlink(path.join(PUBLIC_DIR, f));
    } catch {
      // File didn't exist — nothing to clean
    }
  }
}

export async function PUT(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = body.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 512 kB' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // SVG passes through directly
  if (file.type === 'image/svg+xml') {
    const text = buf.toString('utf-8');
    if (!text.includes('<svg')) {
      return NextResponse.json({ error: 'Invalid SVG file' }, { status: 400 });
    }
    await cleanStale();
    await fs.writeFile(path.join(PUBLIC_DIR, DEST), buf);
    return NextResponse.json({ success: true, message: 'Favicon updated.' });
  }

  // Raster formats (PNG, ICO, JPEG) — wrap in an SVG so the
  // `/favicon.svg` metadata reference always works regardless of format.
  const mime = file.type || 'image/png';
  if (
    mime !== 'image/png' &&
    mime !== 'image/x-icon' &&
    mime !== 'image/vnd.microsoft.icon' &&
    mime !== 'image/jpeg'
  ) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mime}. Use SVG, PNG, ICO, or JPEG.` },
      { status: 400 },
    );
  }

  const b64 = buf.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <image href="data:${mime};base64,${b64}" width="32" height="32"/>
</svg>
`;

  await cleanStale();
  await fs.writeFile(path.join(PUBLIC_DIR, DEST), svg);
  return NextResponse.json({ success: true, message: 'Favicon updated.' });
}
