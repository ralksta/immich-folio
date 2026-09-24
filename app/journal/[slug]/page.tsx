import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { readJournalEntry, listJournalEntries } from '@/lib/admin/journal-service';
import {
  collectAssetIds,
  mapBlockAssetIds,
  type JournalBlock,
  type MapPin,
  type ParsedJournal,
} from '@/lib/journal';
import { entryMapPins } from '@/lib/journalMap';
import { expandAlbumBlocks } from '@/lib/journalAlbum';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { isAuthenticated } from '@/lib/auth';
import { journalNeighbours } from '@/lib/journalNav';
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';
import {
  imageUrl,
  videoUrl,
  exifUrl,
  assetPlaceholder,
  assetAspectRatio,
  assetCaption,
  assetExifSummary,
} from '@/lib/urls';
import { encodeAssetId } from '@/lib/tokens';
import { EssayView } from '@/app/[...path]/EssayView';
import { JournalNav } from '@/components/JournalNav';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';
import type { ImmichAsset } from '@/lib/immich';
import PasswordGate from '@/components/PasswordGate';
import { BackLink } from '@/components/BackLink';
import { getServerDictionary } from '@/lib/i18n/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface JournalDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: JournalDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await readJournalEntry(slug);
  const t = getServerDictionary();
  if (!entry) return { title: t.journal.notFound };

  const { frontmatter } = entry.parsed;

  // generateMetadata runs unconditionally, ahead of the page body's own
  // draft/password gate below — without this check a draft's or a locked
  // entry's real title, subtitle and cover image reached the <head> of a
  // 200 response no authentication was ever asked for (GHSA-fvgv-97g3-wjr7).
  const isAuthedAdmin = await isAdminAuthenticated();
  const blocked =
    (frontmatter.draft && !isAuthedAdmin) ||
    (!!frontmatter.password &&
      !isJournalAuthenticated(
        slug,
        frontmatter.password,
        (await cookies()).get(`lb_auth_journal_${slug}`)?.value,
      ));

  const title = blocked ? t.journal.title : frontmatter.title || slug;
  const description = blocked
    ? t.journal.description
    : frontmatter.subtitle || t.journal.entryDescription;

  const ogImages =
    !blocked && frontmatter.coverAssetId
      ? [{ url: imageUrl(frontmatter.coverAssetId, 'preview') }]
      : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImages,
    },
  };
}

/** Check if journal entry password cookie is valid */
function isJournalAuthenticated(
  slug: string,
  storedPassword?: string,
  cookieVal?: string,
): boolean {
  if (!storedPassword) return true;
  if (!cookieVal) return false;

  const sep = cookieVal.indexOf('.');
  if (sep === -1) return false;

  const expiresAt = Number(cookieVal.slice(0, sep));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const hmac = crypto
    .createHmac('sha256', getConfig().authSecret)
    .update(`${slug}:${storedPassword}:${expiresAt}`)
    .digest('hex');

  const expected = `${expiresAt}.${hmac}`;
  try {
    const a = Buffer.from(cookieVal, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default async function JournalDetailPage({ params }: JournalDetailPageProps) {
  const { slug } = await params;
  const entry = await readJournalEntry(slug);

  if (!entry) {
    notFound();
  }

  const { frontmatter, blocks: authoredBlocks, referencedAssetIds } = entry.parsed;
  const isAuthedAdmin = await isAdminAuthenticated();

  // If draft, only visible to authenticated admin
  if (frontmatter.draft && !isAuthedAdmin) {
    notFound();
  }

  // Password protection check
  if (frontmatter.password) {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(`lb_auth_journal_${slug}`)?.value;

    if (!isJournalAuthenticated(slug, frontmatter.password, cookieVal)) {
      return <PasswordGate slug={slug} title={frontmatter.title || slug} type="journal" />;
    }
  }

  // Prev/next through the other entries a visitor may actually see (#591) —
  // mirrors AlbumNav's rule (#483) of drawing neighbours from the surrounding
  // list rather than a separate order of its own. A draft or a
  // password-protected entry the visitor has not unlocked must not appear
  // here even by name, the same rule the index and this entry's own gate
  // already enforce (GHSA-fvgv-97g3-wjr7).
  const journalCookies = await cookies();
  const allEntries = await listJournalEntries();
  const visibleEntries = isAuthedAdmin
    ? allEntries
    : allEntries.filter((e) => {
        if (e.frontmatter.draft) return false;
        if (!e.frontmatter.password) return true;
        return isAuthenticated(e.slug, (name) => journalCookies.get(name)?.value, 'journal');
      });
  const nav = journalNeighbours(
    visibleEntries.map((e) => ({ slug: e.slug, title: e.frontmatter.title || e.slug })),
    slug,
  );

  const config = getConfig();

  // Fetch all referenced assets from Immich
  const assetPromises = referencedAssetIds.map(async (assetId) => {
    try {
      const asset = await immich.getAssetInfo(assetId);
      return asset;
    } catch {
      return null;
    }
  });

  const fetchedAssets = (await Promise.all(assetPromises)).filter(
    (a): a is ImmichAsset => a !== null,
  );

  // Album blocks become photo blocks here. The raw fetch bypasses the album
  // allowlist on purpose: an entry may already show any single photo by id,
  // and the author's pick is the gate for a whole album just the same. An
  // album Immich cannot deliver drops its block rather than the page.
  const albumAssetsById = new Map<string, ImmichAsset[]>();
  for (const block of authoredBlocks) {
    if (block.type !== 'album' || !block.albumId || albumAssetsById.has(block.albumId)) continue;
    try {
      albumAssetsById.set(block.albumId, await immich.getAlbumAssetsRaw(block.albumId));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[journal] ${slug}: album ${block.albumId} could not be loaded:`, error);
    }
  }
  const { blocks } = expandAlbumBlocks(
    authoredBlocks,
    (albumId) => albumAssetsById.get(albumId),
    config.albumManualOrders,
  );
  const knownIds = new Set(fetchedAssets.map((a) => a.id));
  const rawAssets = [...fetchedAssets];
  for (const list of albumAssetsById.values()) {
    for (const asset of list) {
      if (knownIds.has(asset.id)) continue;
      knownIds.add(asset.id);
      rawAssets.push(asset);
    }
  }

  // EssayView drops photo blocks it cannot resolve, which is right for visitors
  // but leaves no trace of *why* a photo vanished. Legacy positional references
  // ("1", "2") are the usual cause: they only resolved against a subpage album,
  // and a standalone journal entry has none.
  if (fetchedAssets.length < referencedAssetIds.length) {
    const resolved = new Set(fetchedAssets.map((a) => a.id));
    const missing = referencedAssetIds.filter((id) => !resolved.has(id));
    // eslint-disable-next-line no-console
    console.warn(
      `[journal] ${slug}: ${missing.length} photo reference(s) could not be resolved and will not render: ${missing.join(', ')}`,
    );
  }

  /*
   * EssayView resolves a block's photo through PhotoItem.id, and those ids are
   * encrypted tokens — while the blocks coming out of the Markdown carry raw
   * asset UUIDs. Without this translation every photo block fails its lookup and
   * is dropped, so a correctly authored entry renders text only. Doing it here
   * also keeps raw UUIDs out of the client payload, per the project rule that
   * they must never reach the browser. Unresolvable references collapse to an
   * empty string, which EssayView skips.
   */
  const tokenByAssetId = new Map(rawAssets.map((a) => [a.id, encodeAssetId(a.id)]));
  const toToken = (assetId: string) => tokenByAssetId.get(assetId) ?? '';

  // A map block's pins are computed here, from the photos fetched above and
  // under each photo's `location:` precision, and only when the site
  // publishes a map at all. With the map switched off the block is dropped
  // before it can reach the client; with it on, the client gets pins only —
  // never the items, which carry raw asset ids.
  const entryPhotoIds = collectAssetIds(blocks.filter((b) => b.type !== 'map'));
  const pinsByBlock = new Map<JournalBlock, MapPin[]>();
  if (config.map) {
    for (const block of blocks) {
      if (block.type === 'map') {
        pinsByBlock.set(block, await entryMapPins(block.items, rawAssets, entryPhotoIds));
      }
    }
  }

  // Photos that only anchor a map pin are fetched for their EXIF but are not
  // part of the story, so they stay out of the lightbox sequence.
  const shownAssetIds = new Set([
    ...entryPhotoIds,
    ...(frontmatter.coverAssetId ? [frontmatter.coverAssetId] : []),
  ]);

  const essayForClient: ParsedJournal = {
    // Named fields, not a spread of `frontmatter`: EssayView reads only
    // title, subtitle, coverAssetId, author and date, but a spread put the
    // stored password — plaintext or a scrypt hash — into every visitor's
    // RSC payload the moment they unlocked the entry once (GHSA-fvgv-97g3-wjr7).
    frontmatter: {
      title: frontmatter.title,
      subtitle: frontmatter.subtitle,
      author: frontmatter.author,
      date: frontmatter.date,
      coverAssetId: frontmatter.coverAssetId ? toToken(frontmatter.coverAssetId) : undefined,
    },
    blocks: blocks.flatMap((block): JournalBlock[] => {
      if (block.type === 'map') {
        const pins = pinsByBlock.get(block);
        return pins
          ? [{ type: 'map', caption: block.caption, line: block.line, items: [], pins }]
          : [];
      }
      return [mapBlockAssetIds(block, toToken)];
    }),
    referencedAssetIds: rawAssets.map((a) => encodeAssetId(a.id)),
  };

  const images: PhotoItem[] = rawAssets
    .filter((a) => shownAssetIds.has(a.id) && (a.type === 'IMAGE' || a.type === 'VIDEO'))
    .map((a) => {
      const ph = assetPlaceholder(a);
      const exif =
        config.exif.onHover && config.exif.camera && a.type === 'IMAGE'
          ? assetExifSummary(a)
          : undefined;
      const caption = assetCaption(a, config.exif.caption);
      const isVideo = a.type === 'VIDEO';
      return {
        id: encodeAssetId(a.id),
        type: isVideo ? 'video' : 'image',
        thumbUrl: imageUrl(a.id, 'preview'),
        previewUrl: imageUrl(a.id, 'preview'),
        ...(isVideo ? { videoUrl: videoUrl(a.id) } : {}),
        exifUrl: exifUrl(a.id),
        ...(ph ? { blurDataURL: ph.blurDataURL, dominantColor: ph.dominantColor } : {}),
        ...(exif ?? {}),
        ...(caption ? { caption } : {}),
        aspectRatio: assetAspectRatio(a),
      };
    });

  return (
    <div style={{ paddingTop: '2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 1rem' }}>
        <BackLink href="/journal" label={getServerDictionary().common.backToJournal} />
      </div>
      <EssayView
        essay={essayForClient}
        assets={images}
        title={frontmatter.title}
        subtitle={frontmatter.subtitle}
        watermark={config.watermark}
      />
      <JournalNav {...nav} />
    </div>
  );
}
