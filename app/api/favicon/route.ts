import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const CONTENT_DIR = path.resolve(process.cwd(), 'content');

export const dynamic = 'force-dynamic';

export async function GET() {
  let buf: Buffer;
  let contentType: string;

  // Prefer the uploaded favicon in content/ (writable, mounted volume).
  // Fall back to the bundled default in public/.
  try {
    const filePath = path.join(CONTENT_DIR, 'favicon.svg');
    buf = await fs.readFile(filePath);
    contentType = 'image/svg+xml';
  } catch {
    try {
      const filePath = path.join(PUBLIC_DIR, 'favicon.svg');
      buf = await fs.readFile(filePath);
      contentType = 'image/svg+xml';
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
      // /api routes are excluded from the CSP nonce in proxy.ts, so the
      // response must carry its own policy. An uploaded SVG must not be
      // allowed to execute script on the origin.
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
