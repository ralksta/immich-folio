import type { MetadataRoute } from 'next';
import { getConfigOrNull } from '@/lib/config';
import { isSiteLocked } from '@/lib/auth';
import { absoluteUrl } from '@/lib/siteUrl';

/**
 * robots.txt (#472).
 *
 * Reflects the same decision `generateMetadata()` already makes for the robots
 * meta tag, so the two cannot disagree: a site behind a password, or one that
 * asked not to be indexed, is closed to crawlers here as well.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const config = getConfigOrNull();

  // Nothing configured yet — the setup screen is not worth crawling.
  if (!config) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  if (isSiteLocked() || config.seo.noIndex) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  const sitemap = absoluteUrl(config.siteUrl, '/sitemap.xml');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The image proxy, the admin panel and the installer have nothing to
      // offer a crawler and plenty to cost the Immich server behind them.
      disallow: ['/api/', '/admin', '/install'],
    },
    // Omitted rather than guessed when no site URL is configured: robots.txt
    // requires an absolute sitemap URL.
    ...(sitemap ? { sitemap } : {}),
  };
}
