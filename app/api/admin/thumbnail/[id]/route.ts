/**
 * Admin-only thumbnail proxy — serves small thumbnails for the admin panel
 * using raw Immich asset UUIDs (no token encoding needed since admin is authenticated).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';
import { isUuid } from '@/lib/uuid';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getConfig();
  // Credentials, not `needsSetup`: this route is how the operator picks the
  // albums that gallery.yaml is built from, so refusing to run until that file
  // exists is a deadlock (#507).
  if (config.needsCredentials) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const { id: assetId } = await params;

  if (!isUuid(assetId)) {
    return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
  }

  try {
    const res = await fetch(`${config.immich.apiUrl}/assets/${assetId}/thumbnail?size=thumbnail`, {
      headers: {
        'x-api-key': config.immich.apiKey,
        Accept: 'application/octet-stream',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const body = res.body;

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[Admin Thumbnail] Failed to fetch:', err);
    return NextResponse.json({ error: 'Failed to fetch thumbnail' }, { status: 502 });
  }
}
