import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getConfigOrNull } from '@/lib/config';

const ANALYTICS_FILE = path.join(process.cwd(), 'content', 'analytics.json');

export async function GET() {
  try {
    const config = getConfigOrNull();
    let data;
    try {
      const raw = await fs.readFile(ANALYTICS_FILE, 'utf8');
      data = JSON.parse(raw);
    } catch {
      data = { summary: { totalViews: 0, lastUpdated: new Date().toISOString() }, days: {} };
    }

    // Compute top pages across all days
    const topPagesMap: Record<string, number> = {};
    let desktopCount = 0;
    let mobileCount = 0;

    Object.values(data.days || {}).forEach((day: any) => {
      Object.entries(day.pages || {}).forEach(([p, count]: [string, any]) => {
        topPagesMap[p] = (topPagesMap[p] || 0) + count;
      });
      desktopCount += day.devices?.desktop || 0;
      mobileCount += day.devices?.mobile || 0;
    });

    const topPages = Object.entries(topPagesMap)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      trackingEnabled: config?.analytics !== false,
      summary: data.summary,
      days: data.days,
      topPages,
      devices: {
        desktop: desktopCount,
        mobile: mobileCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
