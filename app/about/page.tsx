/**
 * About page — Bauhaus / Leica minimalist layout.
 * Reads content from content/about.md (frontmatter + markdown body).
 */

import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { imageUrl, assetPlaceholder } from '@/lib/urls';
import { immich } from '@/lib/immich';
import { readAboutFile, type AboutContent } from '@/lib/admin/about-service';
import './about.css';

export const dynamic = 'force-dynamic';

async function getAboutContent(): Promise<AboutContent> {
  return readAboutFile();
}

export async function generateMetadata(): Promise<Metadata> {
  const about = await getAboutContent();
  const title = about.name ? `About — ${about.name}` : 'About';
  const description = about.body ? about.body.slice(0, 160).replace(/\s+/g, ' ').trim() : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function AboutPage() {
  const { portrait, name, location, gear, body, enabled } = await getAboutContent();

  if (enabled === false) {
    notFound();
  }

  // Fetch ThumbHash for portrait placeholder
  const portraitAsset = portrait ? await immich.getAssetInfo(portrait) : null;
  const portraitPlaceholder = portraitAsset ? assetPlaceholder(portraitAsset) : null;

  return (
    <div className="about">
      {/* ── Portrait ─────────────────────────────────── */}
      <div className="about__portrait-col">
        {portrait ? (
          <Image
            src={imageUrl(portrait, 'preview')}
            alt={name || 'Portrait'}
            className="about__portrait"
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            {...(portraitPlaceholder
              ? { placeholder: 'blur' as const, blurDataURL: portraitPlaceholder.blurDataURL }
              : {})}
          />
        ) : (
          <div className="about__portrait about__portrait--placeholder" />
        )}
      </div>

      {/* ── Text ─────────────────────────────────────── */}
      <div className="about__text-col">
        <p className="about__kicker" aria-hidden="true">
          About
        </p>
        {name && <h1 className="about__name">{name}</h1>}
        {location && <p className="about__location">{location}</p>}

        <hr className="about__rule" />

        {body && (
          <div className="about__bio">
            {body
              .split('\n')
              .filter(Boolean)
              .map((line, i) => (
                <p key={i}>{line}</p>
              ))}
          </div>
        )}

        {gear && gear.length > 0 && (
          <>
            <hr className="about__rule" />
            <h2 className="about__section-label">Gear</h2>
            <ul className="about__gear">
              {gear.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
