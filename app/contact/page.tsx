/**
 * Contact page (#702). The form posts to /api/contact, which stores the
 * message on this server; see lib/contact.ts.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfig } from '@/lib/config';
import { BackLink } from '@/components/BackLink';
import ContactForm from '@/components/ContactForm';
import { getServerDictionary } from '@/lib/i18n/server';
import './contact.css';

export function generateMetadata(): Metadata {
  return { title: getServerDictionary().contact.title };
}

export const dynamic = 'force-dynamic';

export default function ContactPage() {
  const { contact } = getConfig();
  const t = getServerDictionary();

  if (!contact.enabled) {
    notFound();
  }

  return (
    <div className="contact-page">
      <header className="contact-page__header">
        <BackLink href="/" label={t.common.home} />
        <h1 className="contact-page__title">{t.contact.title}</h1>
        <p className="contact-page__subtitle">{t.contact.subtitle}</p>
      </header>

      <main className="contact-page__content">
        <ContactForm retentionDays={contact.retentionDays} />
      </main>
    </div>
  );
}
