import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { type JournalEntrySummary } from '@/lib/journal';
import { listJournalEntries } from '@/lib/admin/journal-service';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { immich } from '@/lib/immich';
import { imageUrl, assetPlaceholder } from '@/lib/urls';
import { BackLink } from '@/components/BackLink';
import { IconBook } from '@/components/Icons';
import { getServerDictionary } from '@/lib/i18n/server';
import './journal.css';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getServerDictionary();
  return { title: t.journal.title, description: t.journal.description };
}

interface EnrichedJournalEntry extends JournalEntrySummary {
  coverUrl?: string;
  blurDataURL?: string;
  dominantColor?: string;
}

export default async function JournalIndexPage() {
  const t = getServerDictionary();
  const isAuthedAdmin = await isAdminAuthenticated();
  const allEntries = await listJournalEntries();

  // Non-admins only see published entries
  const visibleEntries = isAuthedAdmin
    ? allEntries
    : allEntries.filter((e) => !e.frontmatter.draft);

  // Fetch cover image placeholders and URLs
  const enrichedEntries: EnrichedJournalEntry[] = await Promise.all(
    visibleEntries.map(async (entry) => {
      if (!entry.frontmatter.coverAssetId) {
        return entry;
      }

      try {
        const asset = await immich.getAssetInfo(entry.frontmatter.coverAssetId);
        const ph = asset ? assetPlaceholder(asset) : null;
        return {
          ...entry,
          coverUrl: imageUrl(entry.frontmatter.coverAssetId, 'preview'),
          blurDataURL: ph?.blurDataURL,
          dominantColor: ph?.dominantColor,
        };
      } catch {
        return {
          ...entry,
          coverUrl: imageUrl(entry.frontmatter.coverAssetId, 'preview'),
        };
      }
    }),
  );

  return (
    <div className="journal-index-container">
      <div className="journal-index-header">
        <BackLink href="/" label={t.common.backToGallery} />
        <p className="journal-index-header__kicker" aria-hidden="true">
          {t.journal.kicker}
        </p>
        <h1 className="journal-index-header__title">{t.journal.title}</h1>
        <p className="journal-index-header__subtitle">{t.journal.subtitle}</p>
      </div>

      {enrichedEntries.length === 0 ? (
        <div className="journal-empty-state">
          <p>{t.journal.empty}</p>
        </div>
      ) : (
        <div className="journal-grid">
          {enrichedEntries.map((entry) => {
            const dateStr = entry.frontmatter.date
              ? new Date(entry.frontmatter.date).toLocaleDateString(t.dateLocale, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null;

            return (
              <Link key={entry.slug} href={`/journal/${entry.slug}`} className="journal-card">
                <div
                  className="journal-card__cover"
                  style={{
                    ...(entry.dominantColor ? { backgroundColor: entry.dominantColor } : {}),
                  }}
                >
                  {entry.coverUrl ? (
                    <Image
                      src={entry.coverUrl}
                      alt={entry.frontmatter.title || entry.slug}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                      placeholder={entry.blurDataURL ? 'blur' : 'empty'}
                      blurDataURL={entry.blurDataURL}
                    />
                  ) : (
                    <div className="journal-card__cover-empty">
                      <IconBook size={32} aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="journal-card__content">
                  <div className="journal-card__meta">
                    {dateStr && <span>{dateStr}</span>}
                    {dateStr && entry.readingTimeMinutes && <span>•</span>}
                    {entry.readingTimeMinutes && (
                      <span>{t.journal.minRead(entry.readingTimeMinutes)}</span>
                    )}
                    {entry.frontmatter.draft && (
                      <span className="journal-card__draft-badge">{t.journal.draft}</span>
                    )}
                  </div>

                  <h2 className="journal-card__title">{entry.frontmatter.title || entry.slug}</h2>

                  {entry.frontmatter.subtitle && (
                    <p className="journal-card__subtitle">{entry.frontmatter.subtitle}</p>
                  )}

                  {/*
                    extractExcerpt() falls back to the subtitle when there is
                    one, so rendering both printed the same sentence twice.
                  */}
                  {entry.excerpt && entry.excerpt !== entry.frontmatter.subtitle && (
                    <p className="journal-card__excerpt">{entry.excerpt}</p>
                  )}

                  <div className="journal-card__footer">
                    <span className="journal-card__read-more">{t.journal.readStory}</span>
                    {entry.frontmatter.author && (
                      <span style={{ opacity: 0.65 }}>
                        {t.journal.by(entry.frontmatter.author)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
