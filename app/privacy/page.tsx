/**
 * Privacy policy (#699): content/privacy.md, written by the owner in the
 * admin panel. Folio ships no legal text of its own.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfig } from '@/lib/config';
import { BackLink } from '@/components/BackLink';
import { getServerDictionary } from '@/lib/i18n/server';
import { parseMarkdownBlocks } from '@/lib/markdownBlocks';
import { privacyAvailable, readPrivacy } from '@/lib/privacy';
import './privacy.css';

export function generateMetadata(): Metadata {
  if (!privacyAvailable(getConfig())) return {};
  return {
    title: getServerDictionary().privacy.title,
    robots: { index: false, follow: true },
  };
}

export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const t = getServerDictionary();
  if (!privacyAvailable(getConfig())) notFound();

  const blocks = parseMarkdownBlocks(readPrivacy());

  return (
    <div className="privacy-page">
      <header className="privacy-page__header">
        <BackLink href="/" label={t.common.home} />
        <h1 className="privacy-page__title">{t.privacy.title}</h1>
      </header>

      {/* Every html string below comes from renderInlineMarkdown, which escapes
          the author's text before adding its own tags. */}
      <div className="privacy-page__content">
        {blocks.map((block, i) => {
          if (block.type === 'heading') {
            const Tag = block.level === 2 ? 'h2' : 'h3';
            return <Tag key={i} dangerouslySetInnerHTML={{ __html: block.html }} />;
          }
          if (block.type === 'list') {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List key={i}>
                {block.items.map((item, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </List>
            );
          }
          return <p key={i} dangerouslySetInnerHTML={{ __html: block.html }} />;
        })}
      </div>
    </div>
  );
}
