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
 *   - the assets and thumbnail of every standalone album and every album of
 *     an enabled subpage; a subpage taken offline with `enabled: false` keeps
 *     its albums on the allowlist, but publishes nothing
 *   - the homepage hero list, and the hero image of each album above
 *   - the about.md portrait
 *   - every journal entry: cover, photo blocks, and the assets of its album
 *     blocks (drafts and locked entries included: their page gate still hides
 *     them, and the tokens cannot be guessed)
 *   - every content page (#722): photo blocks and the assets of its album
 *     blocks, drafts and locked pages included for the same reason; its map
 *     blocks are not rendered, so their photos do not count
 *   - album blocks in an enabled subpage's inline essayText
 *   - the album of every open (unexpired) proofing link
 *
 * Built lazily, cached for CACHE_TTL, one build shared by concurrent callers.
 * The admin routes run in their own module instances, so a save cannot reach
 * this cache directly. Instead the set remembers the modification times of
 * the content files it was built from and rebuilds as soon as one changes —
 * so unpublishing an album or revoking a proofing link takes effect at once,
 * not after the TTL. A miss also forces one rebuild before answering "no".
 *
 * "At once" means: every answer comes from a set whose build began after the
 * request looked at the files. The files are stat'ed on every request (they
 * used to be checked at most every 2 s, and a request in that window was
 * answered — `immutable` — from the set before the save), and a build reads
 * the stamp before the content, so a save racing a build leaves the set
 * stamped older than the files instead of newer.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getConfig } from './config';
import { onlineAlbumIds } from './config/schema';
import { immich } from './immich';
import { collectAssetIds, parseJournalMarkdown, type JournalBlock } from './journal';
import { listJournalEntries, readJournalEntry } from './admin/journal-service';
import { listPages, readPage } from './admin/pages-service';
import { isExpired, listSessions } from './proofSessions';

/** A forced rebuild on a miss at most this often, so misses cannot hammer Immich. */
const MIN_REBUILD_MS = 10_000;

const CONTENT = path.join(process.cwd(), 'content');
const WATCHED = [
  'gallery.yaml',
  'settings.yaml',
  'about.md',
  'proofing.json',
  'journal',
  'essays',
  'pages',
];

let current: { assets: Set<string>; builtAt: number; stamp: string; startedAt: number } | null =
  null;
let building: Promise<Set<string>> | null = null;
let lastForcedAt = 0;
/**
 * Orders file checks and build starts. A set whose `startedAt` is above a
 * request's check read the files after that request did, and so answers for
 * it whatever the stamps say.
 */
let clock = 0;

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
  const online = onlineAlbumIds(config);

  // Published albums. A failing album must not empty the whole set.
  await Promise.all(
    [...online].map(async (id) => {
      const album = await immich.getAlbum(id).catch(() => null);
      if (!album) return;
      add(album.albumThumbnailAssetId);
      for (const a of album.assets) add(a.id);
    }),
  );

  config.heroImages.forEach(add);
  for (const [albumId, assetId] of Object.entries(config.albumHeroImages)) {
    if (online.has(albumId)) add(assetId);
  }
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

  // Content pages, drafts and locked ones included. Map blocks are dropped
  // before a page renders, so their photos are not published through it.
  const pages = await listPages().catch(() => []);
  await Promise.all(
    pages.map(async (page) => {
      const read = await readPage(page.slug).catch(() => null);
      if (!read) return;
      const blocks = read.parsed.blocks.filter((b) => b.type !== 'map');
      collectAssetIds(blocks).forEach(add);
      albumBlockIds(blocks).forEach((id) => rawAlbums.add(id));
    }),
  );

  // Inline essays in gallery.yaml: only their album blocks add assets; a photo
  // block outside the subpage's albums is dropped before it becomes a URL.
  for (const sp of config.subpages) {
    if (sp.enabled !== false && sp.essayText) {
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
    const startedAt = ++clock;
    // Stamp first, content second: a save landing mid-build then leaves the
    // set stamped older than the files, and the next check rebuilds. Read in
    // parallel, the stamp could come back newer than the content it labels.
    building = contentStamp()
      .then(async (stamp) => {
        const assets = await build();
        current = { assets, builtAt: Date.now(), stamp, startedAt };
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
    const checkedAt = ++clock;
    const stamp = await contentStamp();
    const stale = () =>
      !current ||
      Date.now() - current.builtAt > ttlMs ||
      (current.stamp !== stamp && current.startedAt < checkedAt);
    // Twice at most: the first rebuild may join a build that started before
    // this check; any build started after that one finished is recent enough.
    for (let i = 0; i < 2 && stale(); i++) await rebuild();
  } catch {
    if (!current) return true;
  }
  if (current!.assets.has(assetId)) return true;

  // Not in the set: it may have been published since the last build. A miss
  // while a rebuild is running waits for it — the first view of a new album is
  // a burst of misses, and refusing all but the one that started the rebuild
  // broke most of its photos. Only with nothing running does the throttle
  // decide whether a miss may start one.
  if (!building) {
    if (Date.now() - lastForcedAt < MIN_REBUILD_MS) return false;
    lastForcedAt = Date.now();
  }
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
  clock = 0;
}
