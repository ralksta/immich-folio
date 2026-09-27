/**
 * Server-only helpers for the subpage essay (story) path in
 * `app/[...path]/page.tsx`.
 *
 * A subpage can borrow a journal entry as its essay via `essayFile: <slug>`.
 * That entry keeps its own `draft` and `password`, and they have to hold here
 * exactly as they do at `/journal/<slug>` — otherwise the subpage becomes a
 * second, ungated door into the same content.
 */
import type { ImmichAsset } from './immich';
import { sanitizeHtml, type ParsedJournal } from './journal';
import { assetCaption } from './urls';
import { isAuthenticated } from './auth';
import { loadEssayFromFile } from './admin/journal-service';

export type EssayFileResult =
  /** Readable by this visitor. */
  | { status: 'open'; parsed: ParsedJournal }
  /** No such entry, or a draft seen by a non-admin — both render as absent. */
  | { status: 'missing' }
  /** The entry has a password this visitor has not entered. */
  | { status: 'locked'; title: string };

export function resolveEssayFile(
  slug: string,
  visitor: { isAdmin: boolean; getCookie: (name: string) => string | undefined },
): EssayFileResult {
  const parsed = loadEssayFromFile(slug);
  if (!parsed) return { status: 'missing' };

  const { frontmatter } = parsed;
  if (frontmatter.draft && !visitor.isAdmin) return { status: 'missing' };
  if (frontmatter.password && !isAuthenticated(slug, visitor.getCookie, 'journal')) {
    return { status: 'locked', title: frontmatter.title || slug };
  }
  return { status: 'open', parsed };
}

/**
 * Caption for a photo in the essay generated from a subpage's albums.
 *
 * EssayView renders captions as HTML, because authored captions arrive already
 * rendered by `renderInlineMarkdown`. An Immich description has not been
 * through that, so it is escaped here — and it follows the `exif.caption`
 * toggle like every other place a description is shown.
 */
export function generatedEssayCaption(
  asset: Pick<ImmichAsset, 'exifInfo'>,
  showCaption: boolean,
): string | undefined {
  const caption = assetCaption(asset, showCaption);
  return caption ? sanitizeHtml(caption) : undefined;
}
