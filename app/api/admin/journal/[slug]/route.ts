import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import {
  isValidSlug,
  sanitizeSlug,
  parseJournalMarkdown,
} from '@/lib/journal';
import {
  readJournalEntry,
  writeJournalEntry,
  deleteJournalEntry,
} from '@/lib/admin/journal-service';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const entry = await readJournalEntry(slug);
    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    console.error(`[Admin API] Failed to get journal entry "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to read journal entry' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      typeof body.newSlug === 'string' && body.newSlug
        ? sanitizeSlug(body.newSlug)
        : slug;

    if (!isValidSlug(targetSlug)) {
      return NextResponse.json({ error: 'Invalid target slug' }, { status: 400 });
    }

    // If renaming, ensure target doesn't already exist
    if (targetSlug !== slug) {
      const existing = await readJournalEntry(targetSlug);
      if (existing) {
        return NextResponse.json({ error: 'Target slug already exists' }, { status: 409 });
      }
      await writeJournalEntry(targetSlug, rawMarkdown);
      await deleteJournalEntry(slug);
    } else {
      await writeJournalEntry(slug, rawMarkdown);
    }

    const updated = await readJournalEntry(targetSlug);
    return NextResponse.json({ success: true, entry: updated });
  } catch (err) {
    console.error(`[Admin API] Failed to update journal entry "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
}
