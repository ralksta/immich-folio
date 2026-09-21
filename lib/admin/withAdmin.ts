import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminEnabled } from './auth';

/**
 * Wraps an admin route handler in the enabled + authenticated check.
 *
 * Every handler under /api/admin is defined inside this wrapper, so a route
 * that forgets its guard is not a diff that merely looks fine: there is no
 * plain `export async function GET` left to copy from. The one exception is
 * /api/admin/auth, the login endpoint, which must stay reachable without a
 * session.
 *
 * The two refusals are kept distinct, as the hand-written copies had them:
 * 403 means the admin panel is switched off for this deployment, 401 means it
 * is on and this caller is not signed in.
 *
 * The handler's own parameters are passed through untouched, so routes taking
 * `(request)`, `(request, context)` or nothing at all all wrap the same way.
 */
export function withAdmin<Args extends unknown[]>(
  handler: (...args: Args) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    if (!isAdminEnabled()) {
      return NextResponse.json({ error: 'Admin not enabled' }, { status: 403 });
    }
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(...args);
  };
}
