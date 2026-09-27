'use client';

import { useRouter } from 'next/navigation';
import { JournalEditor } from '../journal/JournalEditor';

/**
 * The journal's block editor and live preview in page mode (#722). Back goes
 * to Pages with the page selected again.
 */
export function PageContentEditor({ slug }: { slug: string }) {
  const router = useRouter();
  return (
    <JournalEditor
      slug={slug}
      kind="page"
      onBack={() => router.push(`/admin/pages?page=${encodeURIComponent(slug)}`)}
    />
  );
}
