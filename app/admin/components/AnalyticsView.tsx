'use client';

import * as Icons from './Icons';
import { useAdminFetch } from './useAdminFetch';
import AdminLoadState from './AdminLoadState';
import PageHeader from './PageHeader';

interface AnalyticsData {
  trackingEnabled?: boolean;
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
  topPages: { path: string; count: number }[];
  devices: { desktop: number; mobile: number };
}

export default function AnalyticsView() {
  const analytics = useAdminFetch<AnalyticsData>('/api/admin/analytics');
  const data = analytics.data;

  if (!data || analytics.error) {
    return (
      <AdminLoadState
        loading={analytics.loading}
        error={analytics.error}
        onRetry={analytics.reload}
        hasData={!!data}
      />
    );
  }

  const totalViews = data.summary?.totalViews || 0;
  const maxPageViews = data.topPages[0]?.count || 1;
  const daysList = Object.entries(data.days || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14); // Last 14 days
  const maxDayViews = Math.max(...daysList.map(([, d]) => d.pageviews || 0), 1);

  const desktopRatio =
    data.devices.desktop + data.devices.mobile > 0
      ? Math.round((data.devices.desktop / (data.devices.desktop + data.devices.mobile)) * 100)
      : 50;

  return (
    <div className="analytics-view">
      <PageHeader
        kicker="Visitors"
        title="Analytics"
        description="Cookieless page counts, kept on this server. No personal data is collected."
        actions={
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={analytics.reload}>
            <Icons.IconRefresh size={14} /> Refresh
          </button>
        }
      />

      {data.trackingEnabled === false && (
        <div
          className="backup-status-alert error"
          style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Icons.IconLock size={16} />
          <span>
            <strong>Analytics Tracking is Currently Disabled.</strong> No new visitor views are
            being recorded. You can re-enable tracking anytime under{' '}
            <em>Settings &rarr; General</em>.
          </span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="analytics-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Page Views</span>
          <span className="metric-value">{totalViews.toLocaleString()}</span>
          <span className="metric-sub">Lifetime aggregate</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Active Days Tracked</span>
          <span className="metric-value">{Object.keys(data.days || {}).length}</span>
          <span className="metric-sub">Days recorded</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Desktop vs Mobile</span>
          <span className="metric-value">
            {desktopRatio}% / {100 - desktopRatio}%
          </span>
          <span className="metric-sub">Device distribution</span>
        </div>
      </div>

      {/* Daily Trends Chart */}
      <div className="analytics-panel">
        <div className="analytics-section-title">
          <h3>
            <Icons.IconGrid size={16} /> Daily Traffic Trend (Last 14 Days)
          </h3>
        </div>
        {daysList.length === 0 ? (
          <p className="analytics-empty">
            No pageviews recorded yet. Visit portfolio pages to start tracking!
          </p>
        ) : (
          <div className="analytics-bar-chart">
            {daysList.map(([dateStr, dayData]) => {
              const heightPct = Math.round((dayData.pageviews / maxDayViews) * 100);
              const formattedDate = dateStr.slice(5); // MM-DD
              return (
                <div
                  key={dateStr}
                  className="bar-col"
                  title={`${dateStr}: ${dayData.pageviews} views`}
                >
                  <div className="bar-wrapper">
                    <div className="bar-fill" style={{ height: `${Math.max(heightPct, 8)}%` }}>
                      <span className="bar-val">{dayData.pageviews}</span>
                    </div>
                  </div>
                  <span className="bar-label">{formattedDate}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Pages List */}
      <div className="analytics-panel">
        <div className="analytics-section-title">
          <h3>
            <Icons.IconTarget size={16} /> Top Visited Pages &amp; Subpages
          </h3>
        </div>
        {data.topPages.length === 0 ? (
          <p className="analytics-empty">No pages recorded yet.</p>
        ) : (
          <div className="analytics-top-pages">
            {data.topPages.map((p, idx) => {
              const widthPct = Math.round((p.count / maxPageViews) * 100);
              return (
                <div key={p.path} className="top-page-row">
                  <span className="page-rank">#{idx + 1}</span>
                  <div className="page-info">
                    <div className="page-path-line">
                      <span className="page-path">{p.path}</span>
                      <span className="page-count">{p.count} views</span>
                    </div>
                    <div className="page-progress-bg">
                      <div className="page-progress-fill" style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
