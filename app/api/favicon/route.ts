import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const CONTENT_DIR = path.resolve(process.cwd(), 'content');

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Prefer the uploaded favicon in content/ (writable, mounted volume).
  // Fall back to the bundled default in public/.
  let filePath = path.join(CONTENT_DIR, 'favicon.svg');
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    filePath = path.join(PUBLIC_DIR, 'favicon.svg');
    try {
      stat = await fs.stat(filePath);
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }

  // The URL is fixed but its content is not — an upload replaces the file in
  // place. A far-future `immutable` would hide the new icon for as long as the
  // browser kept the old one, so revalidate every time and answer with a 304
  // when nothing changed. The ETag is derived from the file itself, so it moves
  // the moment the admin uploads a new one.
  const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
  const headers = {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    ETag: etag,
    // /api routes are excluded from the CSP nonce in proxy.ts, so the
    // response must carry its own policy. An uploaded SVG must not be
    // allowed to execute script on the origin.
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  const buf = await fs.readFile(filePath);
  return new NextResponse(new Uint8Array(buf), { status: 200, headers });
}
