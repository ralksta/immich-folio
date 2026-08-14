import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { readJournalEntry } from '@/lib/admin/journal-service';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';
import { imageUrl, exifUrl, assetPlaceholder, assetAspectRatio, assetExifSummary } from '@/lib/urls';
import { encodeAssetId } from '@/lib/tokens';
import { EssayView } from '@/app/[...path]/EssayView';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';
import type { ImmichAsset } from '@/lib/immich';
import PasswordGate from '@/components/PasswordGate';
import { BackLink } from '@/components/BackLink';
import { verifyScrypt, isScryptHash } from '@/lib/password';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface JournalDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: JournalDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await readJournalEntry(slug);
  if (!entry) return { title: 'Not Found' };

  const { frontmatter } = entry.parsed;
  const title = frontmatter.title || slug;
  const description = frontmatter.subtitle || 'Journal entry on Immich Folio';

  const ogImages = frontmatter.coverAssetId
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
function isJournalAuthenticated(slug: string, storedPassword?: string, cookieVal?: string): boolean {
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

  const { frontmatter, blocks, referencedAssetIds } = entry.parsed;
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
      return (
        <PasswordGate
          slug={slug}
          title={frontmatter.title || slug}
          type="journal"
        />
      );
    }
  }

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

  const rawAssets = (await Promise.all(assetPromises)).filter((a): a is ImmichAsset => a !== null);

  const images: PhotoItem[] = rawAssets
    .filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO')
    .map((a) => {
      const ph = assetPlaceholder(a);
      const exif = config.exifOnHover && a.type === 'IMAGE' ? assetExifSummary(a) : undefined;
      const isVideo = a.type === 'VIDEO';
      return {
        id: encodeAssetId(a.id),
        rawId: a.id,
        type: isVideo ? 'video' : 'image',
        thumbUrl: imageUrl(a.id, 'preview'),
        previewUrl: imageUrl(a.id, 'preview'),
        exifUrl: exifUrl(a.id),
        ...(ph ? { blurDataURL: ph.blurDataURL, dominantColor: ph.dominantColor } : {}),
        ...(exif ?? {}),
        aspectRatio: assetAspectRatio(a),
      };
    });

  return (
    <div style={{ paddingTop: '2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 1rem' }}>
        <BackLink href="/journal" label="Back to Journal" />
      </div>
      <EssayView
        essay={entry.parsed}
        assets={images}
        title={frontmatter.title}
        subtitle={frontmatter.subtitle}
        watermark={config.watermark}
      />
    </div>
  );
}
