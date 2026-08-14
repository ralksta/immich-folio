import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import {
  sanitizeSlug,
  isValidSlug,
  type JournalFrontmatter,
} from '@/lib/journal';
import {
  listJournalEntries,
  writeJournalEntry,
  readJournalEntry,
} from '@/lib/admin/journal-service';

export async function GET() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const entries = await listJournalEntries();
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[Admin API] Failed to list journal entries:', err);
    return NextResponse.json({ error: 'Failed to list journal entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawTitle = typeof body.title === 'string' ? body.title.trim() : 'Untitled';
    const slug = sanitizeSlug(typeof body.slug === 'string' && body.slug ? body.slug : rawTitle);

    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }

    const existing = await readJournalEntry(slug);
    if (existing) {
      return NextResponse.json({ error: 'A journal entry with this slug already exists' }, { status: 409 });
    }

    const frontmatter: JournalFrontmatter = {
      title: rawTitle,
      date: new Date().toISOString().slice(0, 10),
      draft: true,
      ...(typeof body.subtitle === 'string' && body.subtitle ? { subtitle: body.subtitle } : {}),
      ...(typeof body.author === 'string' && body.author ? { author: body.author } : {}),
      ...(typeof body.coverAssetId === 'string' && body.coverAssetId ? { coverAssetId: body.coverAssetId } : {}),
    };

    let initialMarkdown = body.content;
    if (typeof initialMarkdown !== 'string' || !initialMarkdown) {
      initialMarkdown = `---\ntitle: "${frontmatter.title}"\ndate: "${frontmatter.date}"\ndraft: true\n---\n\nWrite your story here...`;
    }

    await writeJournalEntry(slug, initialMarkdown);
    const created = await readJournalEntry(slug);

    return NextResponse.json({ success: true, entry: created }, { status: 201 });
  } catch (err) {
    console.error('[Admin API] Failed to create journal entry:', err);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}
