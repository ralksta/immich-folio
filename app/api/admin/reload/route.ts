import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { revalidatePath } from 'next/cache';
import { invalidateConfigCache } from '@/lib/config';
import { immich } from '@/lib/immich';

/** POST: Force reload config and clear caches. */
export const POST = withAdmin(async () => {
  invalidateConfigCache();
  immich.invalidateAll();
  revalidatePath('/', 'layout');

  return NextResponse.json({ success: true, message: 'Config and cache reloaded' });
});
