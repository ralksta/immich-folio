import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { readJournalEntryForRequest, listJournalEntriesForRequest } from '@/lib/journal.server';
import type { ParsedJournal } from '@/lib/journal';
import { buildEssayPayload } from '@/app/[...path]/essayPayload';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { isAuthenticated } from '@/lib/auth';
import { journalNeighbours } from '@/lib/journalNav';
import { getConfig } from '@/lib/config';
import { imageUrl } from '@/lib/urls';
import { EssayView } from '@/app/[...path]/EssayView';
import { JournalNav } from '@/components/JournalNav';
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
  const entry = await readJournalEntryForRequest(slug);
  const t = getServerDictionary();
  // Nothing to describe: the requested slug is not echoed, and `robots: null`
  // drops the layout's `index, follow`, which would contradict the noindex
  // Next adds to the 404 below.
  if (!entry) return { title: t.journal.notFound, robots: null };

  const { frontmatter } = entry.parsed;

  // generateMetadata runs unconditionally, ahead of the page body's own
  // draft/password gate below — without this check a draft's or a locked
  // entry's real title, subtitle and cover image reached the <head> of a
  // 200 response no authentication was ever asked for (GHSA-fvgv-97g3-wjr7).
  const isAuthedAdmin = await isAdminAuthenticated();
  // A draft is a 404 for everyone but an admin; describe it as one.
  if (frontmatter.draft && !isAuthedAdmin) return { title: t.journal.notFound, robots: null };
  const blocked =
    !!frontmatter.password &&
    !isJournalAuthenticated(
      slug,
      frontmatter.password,
      (await cookies()).get(`lb_auth_journal_${slug}`)?.value,
    );

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
  const entry = await readJournalEntryForRequest(slug);

  if (!entry) {
    notFound();
  }

  const { frontmatter, blocks: authoredBlocks } = entry.parsed;
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
      // The generic journal title, like generateMetadata above: the index and
      // the prev/next links hide a locked entry by name, so its gate must not
      // print that name either (GHSA-fvgv-97g3-wjr7).
      return (
        <PasswordGate slug={slug} title={getServerDictionary().journal.title} type="journal" />
      );
    }
  }

  // Prev/next through the other entries a visitor may actually see (#591) —
  // mirrors AlbumNav's rule (#483) of drawing neighbours from the surrounding
  // list rather than a separate order of its own. A draft or a
  // password-protected entry the visitor has not unlocked must not appear
  // here even by name, the same rule the index and this entry's own gate
  // already enforce (GHSA-fvgv-97g3-wjr7).
  const journalCookies = await cookies();
  const allEntries = await listJournalEntriesForRequest();
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
  const { essay, images, coverToken } = await buildEssayPayload(authoredBlocks, {
    logTag: 'journal',
    slug,
    allowMap: true,
    coverAssetId: frontmatter.coverAssetId,
  });

  const essayForClient: ParsedJournal = {
    ...essay,
    // Named fields, not a spread of `frontmatter`: EssayView reads only
    // title, subtitle, coverAssetId, author and date, but a spread put the
    // stored password — plaintext or a scrypt hash — into every visitor's
    // RSC payload the moment they unlocked the entry once (GHSA-fvgv-97g3-wjr7).
    frontmatter: {
      title: frontmatter.title,
      subtitle: frontmatter.subtitle,
      author: frontmatter.author,
      date: frontmatter.date,
      coverAssetId: coverToken,
    },
  };

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
