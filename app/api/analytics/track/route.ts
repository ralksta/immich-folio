import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const ANALYTICS_FILE = path.join(CONTENT_DIR, 'analytics.json');

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
    await fs.writeFile(ANALYTICS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Analytics] Failed to save analytics data:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pagePath = (body.path || '/').split('?')[0];
    const userAgent = req.headers.get('user-agent') || '';
    const isMobile = /mobile|iphone|ipad|android/i.test(userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';

    const dateKey = new Date().toISOString().split('T')[0];
    const data = await getAnalytics();

    data.summary.totalViews = (data.summary.totalViews || 0) + 1;
    data.summary.lastUpdated = new Date().toISOString();

    if (!data.days[dateKey]) {
      data.days[dateKey] = { pageviews: 0, pages: {}, devices: {} };
    }

    const dayObj = data.days[dateKey];
    dayObj.pageviews = (dayObj.pageviews || 0) + 1;
    dayObj.pages[pagePath] = (dayObj.pages[pagePath] || 0) + 1;
    dayObj.devices[deviceType] = (dayObj.devices[deviceType] || 0) + 1;

    await saveAnalytics(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to record tracking' }, { status: 500 });
  }
}
