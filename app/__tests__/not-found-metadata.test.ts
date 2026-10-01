import { describe, it, expect, vi } from 'vitest';

/**
 * A 404 decided before streaming — by proxy.ts, or by a page calling
 * notFound() outside any Suspense boundary — is rendered from app/not-found.tsx
 * inside the root layout, and Next takes its metadata from the layouts and
 * that file, never from the page. Without metadata of its own the tab showed
 * the bare site title, and the layout's `index, follow` sat next to Next's
 * `noindex`; the soft-404 path meanwhile read "Not found".
 */

vi.mock('@/lib/i18n/server', async () => {
  const { getDictionary } = await import('@/lib/i18n');
  return { getServerDictionary: () => getDictionary('de') };
});

import * as notFoundModule from '../not-found';
import { getDictionary } from '@/lib/i18n';

describe('app/not-found.tsx metadata', () => {
  it('titles a hard 404 from the dictionary and drops the layout robots tag', async () => {
    const { generateMetadata } = notFoundModule as { generateMetadata?: () => unknown };
    expect(typeof generateMetadata).toBe('function');
    expect(await generateMetadata!()).toEqual({
      title: getDictionary('de').error.notFoundTitle,
      robots: null,
    });
  });
});
