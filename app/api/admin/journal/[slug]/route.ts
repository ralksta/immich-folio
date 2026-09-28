import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { isValidSlug, sanitizeSlug, parseJournalMarkdown } from '@/lib/journal';
import { hashFrontmatterPassword } from '@/lib/admin/passwordHashing';
import {
  readJournalEntry,
  saveJournalEntry,
  deleteJournalEntry,
} from '@/lib/admin/journal-service';
import {
  VersionConflictError,
  baseVersionFrom,
  conflictResponse,
  etag,
} from '@/lib/admin/contentVersion';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const GET = withAdmin(async (request: Request, context: RouteContext) => {
  const { slug } = await context.params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const entry = await readJournalEntry(slug);
    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }
    // `version` goes back in If-Match on save (#601).
    const version = entry.version;
    return NextResponse.json({ entry, version }, { headers: { ETag: etag(version) } });
  } catch (err) {
    console.error(`[Admin API] Failed to get journal entry "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to read journal entry' }, { status: 500 });
  }
});

export const PUT = withAdmin(async (request: Request, context: RouteContext) => {
  const { slug } = await context.params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const rawMarkdown = body.rawMarkdown ?? body.content;

    if (typeof rawMarkdown !== 'string') {
      return NextResponse.json({ error: 'Missing rawMarkdown content' }, { status: 400 });
    }

    // Verify markdown can be parsed safely
    parseJournalMarkdown(rawMarkdown);

    const targetSlug =
      typeof body.newSlug === 'string' && body.newSlug ? sanitizeSlug(body.newSlug) : slug;

    if (!isValidSlug(targetSlug)) {
      return NextResponse.json({ error: 'Invalid target slug' }, { status: 400 });
    }

    // If renaming, ensure target doesn't already exist
    if (targetSlug !== slug) {
      const existing = await readJournalEntry(targetSlug);
      if (existing) {
        return NextResponse.json({ error: 'Target slug already exists' }, { status: 409 });
      }
    }

    // The entry's password is stored hashed (#690). The file as it is now
    // supplies the hash to keep when the password did not change.
    const current = await readJournalEntry(slug);
    const markdown = await hashFrontmatterPassword(rawMarkdown, current?.rawMarkdown ?? null);

    // A rename is checked against the file the editor loaded, the old slug.
    const version = await saveJournalEntry(targetSlug, markdown, {
      baseVersion: baseVersionFrom(request),
      fromSlug: slug,
    });

    const updated = await readJournalEntry(targetSlug);
    return NextResponse.json({ success: true, entry: updated, version });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflictResponse(err.currentVersion);
    console.error(`[Admin API] Failed to update journal entry "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: Request, context: RouteContext) => {
  const { slug } = await context.params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const deleted = await deleteJournalEntry(slug);
    if (!deleted) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deletedSlug: slug });
  } catch (err) {
    console.error(`[Admin API] Failed to delete journal entry "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 });
  }
});
