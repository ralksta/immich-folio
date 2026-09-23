/**
 * What the admin panel sees of a proofing session: the stored record plus the
 * album's name and the state, without the Immich lookups repeated per caller.
 */

import { immich, type ImmichAlbum } from '@/lib/immich';
import { imageUrl } from '@/lib/urls';
import {
  downloadsRemaining,
  sessionState,
  type ProofSession,
  type ProofState,
} from '@/lib/proofSessions';

export interface AdminProofSession {
  id: string;
  clientName: string;
  albumId: string;
  /** Null when Immich no longer has the album (or cannot be reached). */
  albumName: string | null;
  albumAssetCount: number | null;
  /** Relative path of the client link. */
  link: string;
  createdAt: string;
  expiresOn: string | null;
  download: ProofSession['download'];
  downloadLimit: number | null;
  downloadsUsed: number;
  downloadsRemaining: number | null;
  selected: number;
  updatedAt: string | null;
  submittedAt: string | null;
  state: ProofState;
}

export interface AdminProofPick {
  assetId: string;
  position: number;
  fileName: string;
  thumbUrl: string;
  takenAt?: string;
}

/** Load each album once, tolerating ones that are gone or unreachable. */
export async function loadAlbums(ids: string[]): Promise<Map<string, ImmichAlbum | null>> {
  const unique = Array.from(new Set(ids));
  const albums = await Promise.all(
    unique.map((id) => immich.getProofingAlbum(id).catch(() => null)),
  );
  return new Map(unique.map((id, i) => [id, albums[i]]));
}

export function toAdminSession(
  session: ProofSession,
  album: ImmichAlbum | null,
): AdminProofSession {
  return {
    id: session.id,
    clientName: session.clientName,
    albumId: session.albumId,
    albumName: album?.albumName ?? null,
    albumAssetCount: album ? album.assets.length : null,
    link: `/proof/${session.token}`,
    createdAt: session.createdAt,
    expiresOn: session.expiresOn ?? null,
    download: session.download,
    downloadLimit: session.downloadLimit ?? null,
    downloadsUsed: session.downloadsUsed,
    downloadsRemaining: downloadsRemaining(session),
    selected: session.selection.length,
    updatedAt: session.updatedAt ?? null,
    submittedAt: session.submittedAt ?? null,
    state: sessionState(session),
  };
}

/** The selected photos in album order, with what the export and preview need. */
export function picksFor(session: ProofSession, album: ImmichAlbum | null): AdminProofPick[] {
  if (!album) return [];
  const chosen = new Set(session.selection);
  const media = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO');
  const picks: AdminProofPick[] = [];
  media.forEach((asset, index) => {
    if (!chosen.has(asset.id)) return;
    picks.push({
      assetId: asset.id,
      position: index + 1,
      fileName: asset.originalFileName,
      thumbUrl: imageUrl(asset.id, 'thumbnail'),
      ...(asset.localDateTime || asset.fileCreatedAt
        ? { takenAt: asset.localDateTime ?? asset.fileCreatedAt }
        : {}),
    });
  });
  return picks;
}
