/**
 * Footer — minimal footer with photographer name + social links.
 * Reads configuration from gallery.yaml via getConfig().
 */

import Link from 'next/link';
import { getConfig } from '@/lib/config';

export function Footer() {
  const config = getConfig();
  const { footer, legal } = config;

  // Don't render if no footer config AND no legal config
  if (
    !legal.enabled &&
    (!footer || (!footer.name && !footer.instagram && !footer.email && !footer.website))
  ) {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__left">
          {footer?.name && <span className="footer__name">{footer.name}</span>}
          {legal.enabled && (
            <Link href="/impressum" className="footer__legal-link">
              Impressum
            </Link>
          )}
        </div>

        <div className="footer__links">
          {footer?.instagram && (
            <a
              href={`https://instagram.com/${footer.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="footer__link"
              aria-label="Instagram"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          )}
          {footer?.email && (
            <a href={`mailto:${footer.email}`} className="footer__link" aria-label="Email">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </a>
          )}
          {footer?.website && (
            <a
              href={footer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="footer__link"
              aria-label="Website"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
