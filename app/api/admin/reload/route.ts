import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated, isAdminEnabled } from '@/lib/admin/auth';
import { invalidateConfigCache } from '@/lib/config';
import { immich } from '@/lib/immich';

/** POST: Force reload config and clear caches. */
export async function POST() {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  invalidateConfigCache();
  immich.invalidateAll();
  revalidatePath('/', 'layout');

  return NextResponse.json({ success: true, message: 'Config and cache reloaded' });
}
