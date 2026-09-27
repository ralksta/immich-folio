/**
 * The set of Immich assets the public site currently shows somewhere.
 *
 * Asset tokens are deterministic, so a media URL that was ever served stays
 * decodable. Without a membership check, /api/image, /api/video and /api/exif
 * kept streaming an asset after its album was unpublished or a proofing link
 * was revoked (GHSA-gfh4-6275-9gqv). The media routes now ask this module.
 *
 * What counts as published — every source that turns an asset ID into a
 * public URL:
 *   - the assets and thumbnail of every allowlisted album
 *   - the homepage hero list and per-album hero images (gallery.yaml)
 *   - the about.md portrait
 *   - every journal entry: cover, photo blocks, and the assets of its album
 *     blocks (drafts and locked entries included: their page gate still hides
 *     them, and the tokens cannot be guessed)
 *   - album blocks in a subpage's inline essayText
 *   - the album of every open (unexpired) proofing link
 *
 * Built lazily, cached for CACHE_TTL, one build shared by concurrent callers.
 * The admin routes run in their own module instances, so a save cannot reach
 * this cache directly. Instead the set remembers the modification times of
 * the content files it was built from and rebuilds as soon as one changes —
 * so unpublishing an album or revoking a proofing link takes effect at once,
 * not after the TTL. A miss also forces one rebuild before answering "no".
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getConfig } from './config';
import { immich } from './immich';
import { collectAssetIds, parseJournalMarkdown, type JournalBlock } from './journal';
import { listJournalEntries, readJournalEntry } from './admin/journal-service';
import { isExpired, listSessions } from './proofSessions';

/** A forced rebuild on a miss at most this often, so misses cannot hammer Immich. */
const MIN_REBUILD_MS = 10_000;
/** How often the content files are stat'ed for changes. */
const STAT_EVERY_MS = 2_000;

const CONTENT = path.join(process.cwd(), 'content');
const WATCHED = ['gallery.yaml', 'settings.yaml', 'about.md', 'proofing.json', 'journal', 'essays'];

let current: { assets: Set<string>; builtAt: number; stamp: string } | null = null;
let lastStatAt = 0;
let building: Promise<Set<string>> | null = null;
let lastForcedAt = 0;

function albumBlockIds(blocks: readonly JournalBlock[]): string[] {
  return blocks.flatMap((b) => (b.type === 'album' && b.albumId ? [b.albumId] : []));
}

async function aboutPortrait(): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'content', 'about.md'), 'utf-8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const meta = match ? (yaml.load(match[1]) as { portrait?: unknown } | null) : null;
    return typeof meta?.portrait === 'string' ? meta.portrait : null;
  } catch {
    return null;
  }
}

/** Modification times of everything the set is built from. */
async function contentStamp(): Promise<string> {
  const times = await Promise.all(
    WATCHED.map((name) =>
      fs.stat(path.join(CONTENT, name)).then(
        (st) => st.mtimeMs,
        () => 0,
      ),
    ),
  );
  return times.join(':');
}

async function build(): Promise<Set<string>> {
  const config = getConfig();
  const assets = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id) assets.add(id);
  };
  const rawAlbums = new Set<string>();

  // Allowlisted albums. A failing album must not empty the whole set.
  await Promise.all(
    config.albums.map(async (id) => {
      const album = await immich.getAlbum(id).catch(() => null);
      if (!album) return;
      add(album.albumThumbnailAssetId);
      for (const a of album.assets) add(a.id);
    }),
  );

  config.heroImages.forEach(add);
  Object.values(config.albumHeroImages).forEach(add);
  add(await aboutPortrait());

  // Journal entries, including drafts and locked ones (see above).
  const entries = await listJournalEntries().catch(() => []);
  await Promise.all(
    entries.map(async (entry) => {
      const read = await readJournalEntry(entry.slug).catch(() => null);
      if (!read) return;
      add(read.parsed.frontmatter.coverAssetId);
      collectAssetIds(read.parsed.blocks).forEach(add);
      albumBlockIds(read.parsed.blocks).forEach((id) => rawAlbums.add(id));
    }),
  );

  // Inline essays in gallery.yaml: only their album blocks add assets; a photo
  // block outside the subpage's albums is dropped before it becomes a URL.
  for (const sp of config.subpages) {
    if (sp.essayText) {
      albumBlockIds(parseJournalMarkdown(sp.essayText).blocks).forEach((id) => rawAlbums.add(id));
    }
  }

  // Open proofing links. Their albums are usually not published.
  const sessions = await listSessions().catch(() => []);
  const proofAlbums = new Set(sessions.filter((s) => !isExpired(s)).map((s) => s.albumId));
  await Promise.all(
    [...proofAlbums].map(async (id) => {
      const album = await immich.getProofingAlbum(id).catch(() => null);
      for (const a of album?.assets ?? []) add(a.id);
    }),
  );

  await Promise.all(
    [...rawAlbums].map(async (id) => {
      const list = await immich.getAlbumAssetsRaw(id).catch(() => []);
      for (const a of list) add(a.id);
    }),
  );

  return assets;
}

function rebuild(): Promise<Set<string>> {
  if (!building) {
    building = Promise.all([contentStamp(), build()])
      .then(([stamp, assets]) => {
        current = { assets, builtAt: Date.now(), stamp };
        return assets;
      })
      .finally(() => {
        building = null;
      });
  }
  return building;
}

/**
 * Whether the public site currently shows this asset anywhere.
 *
 * Fails open when the set cannot be built at all (Immich down on a cold
 * start): refusing every photo would take the site down, and the tokens are
 * unguessable either way. Once built, a stale set is kept through outages.
 */
export async function isPublishedAsset(assetId: string): Promise<boolean> {
  const ttlMs = getConfig().cacheTtl * 1000;
  try {
    let stale = !current || Date.now() - current.builtAt > ttlMs;
    if (!stale && Date.now() - lastStatAt > STAT_EVERY_MS) {
      lastStatAt = Date.now();
      stale = (await contentStamp()) !== current!.stamp;
    }
    if (stale) await rebuild();
  } catch {
    if (!current) return true;
  }
  if (current!.assets.has(assetId)) return true;

  // Not in the set: it may have been published since the last build.
  if (Date.now() - lastForcedAt < MIN_REBUILD_MS) return false;
  lastForcedAt = Date.now();
  try {
    return (await rebuild()).has(assetId);
  } catch {
    return false;
  }
}

/** Drop the cached set, e.g. after a save that publishes or unpublishes photos. */
export function invalidatePublishedAssets(): void {
  current = null;
}

/** Test hook. */
export function resetPublishedAssetsForTest(): void {
  current = null;
  building = null;
  lastForcedAt = 0;
  lastStatAt = 0;
}
