import type { MetadataRoute } from 'next';
import { getConfigOrNull } from '@/lib/config';
import { buildSiteShape } from '@/lib/siteShape';
import { publicPaths } from '@/lib/publicPages';
import { absoluteUrl } from '@/lib/siteUrl';

/**
 * sitemap.xml (#472).
 *
 * What goes in is decided by `publicPaths()`, the same function the feed uses,
 * because a sitemap lists exactly what access control otherwise hides and a
 * second implementation of that judgement would eventually disagree with the
 * first.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getConfigOrNull();

  // A sitemap needs absolute URLs and this route has no request context to
  // derive a host from. Without a configured site URL there is nothing valid
  // to emit, and an empty sitemap is better than a wrong one.
  if (!config?.siteUrl) return [];

  const shape = await buildSiteShape().catch(() => null);
  if (!shape) return [];

  return publicPaths(shape).flatMap((path) => {
    const url = absoluteUrl(config.siteUrl, path);
    return url ? [{ url, changeFrequency: 'weekly' as const }] : [];
  });
}
