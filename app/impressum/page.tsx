/**
 * Impressum (Legal Notice) page.
 * Required for German law compliance. Displays information from settings.yaml.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfig } from '@/lib/config';
import { BackLink } from '@/components/BackLink';
import { getServerDictionary } from '@/lib/i18n/server';
import './impressum.css';

export function generateMetadata(): Metadata {
  return {
    title: getServerDictionary().legal.title,
    robots: { index: false, follow: true }, // Usually no need to index legal pages
  };
}

export const dynamic = 'force-dynamic';

export default function ImpressumPage() {
  const { legal } = getConfig();
  const t = getServerDictionary();

  if (!legal.enabled) {
    notFound();
  }

  return (
    <div className="subpage-container">
      <header className="subpage-header">
        <BackLink href="/" label={t.common.home} />
        <h1 className="subpage-title">{t.legal.title}</h1>
        <p className="subpage-subtitle">{t.legal.subtitle}</p>
      </header>

      <main className="subpage-content">
        <section className="legal-section">
          <h2 className="legal-section__title">{t.legal.address}</h2>
          <p className="legal-section__text">
            {legal.name}
            <br />
            {legal.address}
            <br />
            {legal.zipCity}
            <br />
            {legal.country}
          </p>
        </section>

        {(legal.email || legal.phone) && (
          <section className="legal-section">
            <h2 className="legal-section__title">{t.legal.contact}</h2>
            <p className="legal-section__text">
              {legal.email && (
                <>
                  {t.legal.email}: {legal.email}
                  <br />
                </>
              )}
              {legal.phone && (
                <>
                  {t.legal.phone}: {legal.phone}
                </>
              )}
            </p>
          </section>
        )}

        {(legal.taxId || legal.vatId) && (
          <section className="legal-section">
            <h2 className="legal-section__title">{t.legal.taxSection}</h2>
            <p className="legal-section__text">
              {legal.taxId && (
                <>
                  {t.legal.taxId}: {legal.taxId}
                  <br />
                </>
              )}
              {legal.vatId && (
                <>
                  {t.legal.vatId}: {legal.vatId}
                </>
              )}
            </p>
          </section>
        )}

        {legal.extraInfo && (
          <section className="legal-section">
            <h2 className="legal-section__title">{t.legal.extraInfo}</h2>
            <p className="legal-section__text legal-section__text--pre">{legal.extraInfo}</p>
          </section>
        )}

        <section className="legal-source">
          <p>{t.legal.source}</p>
        </section>
      </main>
    </div>
  );
}
