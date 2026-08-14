import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';

const CONTENT_DIR = path.resolve(process.cwd(), 'content');
const DEST = 'favicon.svg';

const MAX_SIZE = 512 * 1024; // 512 kB

/**
 * Write via temp file + rename, the same pattern yaml-service uses: GET
 * /api/favicon reads this path on every request, so a plain writeFile would
 * let a concurrent read see a half-written icon.
 */
async function writeFavicon(content: Buffer | string): Promise<void> {
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  const dest = path.join(CONTENT_DIR, DEST);
  const tmpPath = `${dest}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmpPath, content);
    await fs.rename(tmpPath, dest);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
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

  // A plain text field named "file" also satisfies `body.get('file')`, and the
  // .size/.arrayBuffer() calls below would then throw a 500 on what is really
  // a malformed request.
  const file = body.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 512 kB' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // SVG passes through directly — CSP on the GET route protects the origin.
  if (file.type === 'image/svg+xml') {
    const text = buf.toString('utf-8');
    if (!text.includes('<svg')) {
      return NextResponse.json({ error: 'Invalid SVG file' }, { status: 400 });
    }
    await writeFavicon(buf);
    return NextResponse.json({ success: true, message: 'Favicon updated.' });
  }

  // Raster formats (PNG, ICO, JPEG) — wrap in an SVG container so the favicon
  // reference and CSP apply uniformly regardless of the uploaded format.
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

  await writeFavicon(svg);
  return NextResponse.json({ success: true, message: 'Favicon updated.' });
}

/** Clean up stale favicon files left by a previous upload of a different format. */
export async function DELETE() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await fs.unlink(path.join(CONTENT_DIR, DEST));
    return NextResponse.json({
      success: true,
      message: 'Custom favicon removed. Default restored.',
    });
  } catch {
    return NextResponse.json({ error: 'No custom favicon to remove' }, { status: 404 });
  }
}
