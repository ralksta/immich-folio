import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { picksFor } from '@/lib/admin/proofing-view';
import { immich } from '@/lib/immich';
import { getSessionById } from '@/lib/proofSessions';
import {
  exportContentType,
  exportExtension,
  formatExport,
  type ExportFormat,
} from '@/lib/proofExport';
import { contentDisposition, safeDownloadName } from '@/lib/downloadName';

const FORMATS: ExportFormat[] = ['lightroom', 'txt', 'csv'];

/** GET ?format=lightroom|txt|csv — the selection as a file. */
export const GET = withAdmin(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const requested = request.nextUrl.searchParams.get('format') as ExportFormat | null;
    const format = requested && FORMATS.includes(requested) ? requested : 'lightroom';

    const session = await getSessionById(id);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const album = await immich.getProofingAlbum(session.albumId).catch(() => null);
    if (!album) {
      return NextResponse.json({ error: 'The album is not available in Immich' }, { status: 502 });
    }

    const body = formatExport(picksFor(session, album), format);
    const name = `${safeDownloadName(`${session.clientName} ${album.albumName}`, 'selection')}.${exportExtension(format)}`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': exportContentType(format),
        'Content-Disposition': contentDisposition(name),
        'Cache-Control': 'private, no-store',
      },
    });
  },
);
