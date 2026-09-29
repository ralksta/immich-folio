import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getConfigOrNull } from '@/lib/config';
import { siteLockResponse } from '@/lib/auth';
import { atomicWrite } from '@/lib/atomicWrite';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const ANALYTICS_FILE = path.join(CONTENT_DIR, 'analytics.json');

/** Requests per minute per IP. One real pageview fires this once. */
const ANALYTICS_RPM = 60;

/**
 * Distinct page paths tracked per day. Every route this comparably-sized site
 * has, many times over — high enough that no real page is ever dropped, low
 * enough that a flood of made-up paths cannot grow the file without bound.
 * A path over the cap still counts toward the day's total pageviews; it just
 * does not get its own key.
 */
const MAX_PAGES_PER_DAY = 500;

/** Well past any real route on this app; anything longer is not a path someone navigated to. */
const MAX_PATH_LENGTH = 200;

/**
 * The path as it is counted. A client proofing link's path carries its token
 * (/proof/<token>), which is the client's only credential: proofing.json is
 * written 0600 for that reason, and this file is not. Every link is counted as
 * `/proof`, so the counter never holds a working link.
 */
function countedPath(pagePath: string): string {
  return /^\/proof(?:\/|$)/.test(pagePath) ? '/proof' : pagePath;
}

interface AnalyticsData {
  summary: {
    totalViews: number;
    lastUpdated: string;
  };
  days: Record<
    string,
    {
      pageviews: number;
      pages: Record<string, number>;
      devices: Record<string, number>;
    }
  >;
}

async function getAnalytics(): Promise<AnalyticsData> {
  try {
    const raw = await fs.readFile(ANALYTICS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { summary: { totalViews: 0, lastUpdated: new Date().toISOString() }, days: {} };
  }
}

async function saveAnalytics(data: AnalyticsData) {
  try {
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    // Temp-file + rename, not a plain write: a process killed mid-write used
    // to truncate the file, and a truncated (unparseable) file made the next
    // getAnalytics() silently reset every count to zero.
    await atomicWrite(ANALYTICS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Analytics] Failed to save analytics data:', err);
  }
}

/**
 * Serializes the read-modify-write below within this process. Two concurrent
 * requests each reading the file, incrementing their own in-memory copy and
 * writing it back would silently drop whichever one wrote last — the file's
 * own atomicity (saveAnalytics above) does not cover that race, only the
 * write itself.
 */
let writeQueue: Promise<void> = Promise.resolve();

export async function POST(req: NextRequest) {
  // A locked site accepts nothing from strangers, the same rule as
  // /api/contact: without it anyone could write paths of their choosing into
  // analytics.json. The gate page itself is not counted — the layout mounts
  // no tracker there — so a visitor who unlocked the site loses nothing.
  const locked = siteLockResponse(req);
  if (locked) return locked;

  try {
    const config = getConfigOrNull();
    if (config?.analytics === false) {
      return NextResponse.json({ ok: true, trackingDisabled: true });
    }

    const ip = getClientIp(req);
    const { success, resetAt } = checkRateLimit(`analytics:${ip}`, ANALYTICS_RPM);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds(resetAt)),
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    const body = await req.json().catch(() => null);
    const rawPath = typeof body?.path === 'string' ? body.path : '/';
    const pagePath = countedPath(rawPath.split('?')[0].slice(0, MAX_PATH_LENGTH) || '/');
    const userAgent = req.headers.get('user-agent') || '';
    const isMobile = /mobile|iphone|ipad|android/i.test(userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';
    const dateKey = new Date().toISOString().split('T')[0];

    const run = writeQueue.then(async () => {
      const data = await getAnalytics();

      data.summary.totalViews = (data.summary.totalViews || 0) + 1;
      data.summary.lastUpdated = new Date().toISOString();

      if (!data.days[dateKey]) {
        data.days[dateKey] = { pageviews: 0, pages: {}, devices: {} };
      }

      const dayObj = data.days[dateKey];
      dayObj.pageviews = (dayObj.pageviews || 0) + 1;
      dayObj.devices[deviceType] = (dayObj.devices[deviceType] || 0) + 1;

      // An already-tracked path may still increment past the cap; only a
      // brand-new key is refused once the day is full.
      if (
        dayObj.pages[pagePath] !== undefined ||
        Object.keys(dayObj.pages).length < MAX_PAGES_PER_DAY
      ) {
        dayObj.pages[pagePath] = (dayObj.pages[pagePath] || 0) + 1;
      }

      await saveAnalytics(data);
    });
    writeQueue = run.catch(() => {});
    await run;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to record tracking' }, { status: 500 });
  }
}
