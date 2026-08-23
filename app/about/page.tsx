/**
 * About page — Bauhaus / Leica minimalist layout.
 * Reads content from content/about.md (frontmatter + markdown body).
 */

import { promises as fsPromises } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import Image from 'next/image';
import type { Metadata } from 'next';
import { imageUrl, assetPlaceholder } from '@/lib/urls';
import { immich } from '@/lib/immich';
import { getConfig } from '@/lib/config';
import { getServerDictionary } from '@/lib/i18n/server';
import { notFound } from 'next/navigation';
import './about.css';

export const dynamic = 'force-dynamic';

interface AboutFrontmatter {
  portrait?: string;
  name?: string;
  location?: string;
  gear?: string[];
}

async function getAboutContent() {
  const filePath = join(process.cwd(), 'content', 'about.md');
  let raw: string;

  try {
    raw = await fsPromises.readFile(filePath, 'utf-8');
  } catch {
    return { meta: {} as AboutFrontmatter, body: '' };
  }

  let meta = {} as AboutFrontmatter;
  let body = raw;

  const match = raw.match(/^(?:---\r?\n)([\s\S]*?)(?:\r?\n---\r?\n)([\s\S]*)$/);
  if (match) {
    try {
      meta = (yaml.load(match[1]) || {}) as AboutFrontmatter;
    } catch (e) {
      console.error('Failed to parse about.md frontmatter', e);
    }
    body = match[2];
  }

  return { meta, body: body.trim() };
}

export async function generateMetadata(): Promise<Metadata> {
  const { meta, body } = await getAboutContent();
  const t = getServerDictionary();
  const title = meta.name ? t.about.metaTitle(meta.name) : t.about.title;
  const description = body ? body.slice(0, 160).replace(/\s+/g, ' ').trim() : undefined;

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
  const config = getConfig();
  if (!config.aboutEnabled) notFound();
  const t = getServerDictionary();

  const { meta, body } = await getAboutContent();

  // Fetch ThumbHash for portrait placeholder
  const portraitAsset = meta.portrait ? await immich.getAssetInfo(meta.portrait) : null;
  const portraitPlaceholder = portraitAsset ? assetPlaceholder(portraitAsset) : null;

  return (
    <div className="about">
      {/* ── Portrait ─────────────────────────────────── */}
      <div className="about__portrait-col">
        {meta.portrait ? (
          <Image
            src={imageUrl(meta.portrait, 'preview')}
            alt={meta.name || t.about.portraitAlt}
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
          {t.about.kicker}
        </p>
        {meta.name && <h1 className="about__name">{meta.name}</h1>}
        {meta.location && <p className="about__location">{meta.location}</p>}

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

        {meta.gear && meta.gear.length > 0 && (
          <>
            <hr className="about__rule" />
            <h2 className="about__section-label">{t.about.gear}</h2>
            <ul className="about__gear">
              {meta.gear.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
