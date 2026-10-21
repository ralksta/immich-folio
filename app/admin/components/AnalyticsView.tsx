'use client';

import * as Icons from './Icons';
import { useAdminFetch } from './useAdminFetch';
import AdminLoadState from './AdminLoadState';
import PageHeader from './PageHeader';
import { lastDays } from './analyticsDays';
import { rich, useAdminDictionary } from './AdminI18n';

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
  const v = useAdminDictionary().visitors;
  const t = v.analytics;
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
  const hasDays = Object.keys(data.days || {}).length > 0;
  const daysList = lastDays(data.days || {}, 14, new Date());
  const maxDayViews = Math.max(...daysList.map((d) => d.pageviews), 1);

  const desktopRatio =
    data.devices.desktop + data.devices.mobile > 0
      ? Math.round((data.devices.desktop / (data.devices.desktop + data.devices.mobile)) * 100)
      : 50;

  return (
    <div className="analytics-view">
      <PageHeader
        kicker={v.kicker}
        title={t.title}
        description={t.description}
        actions={
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={analytics.reload}>
            <Icons.IconRefresh size={14} /> {v.refresh}
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
            {rich(t.disabled, {
              title: <strong>{t.disabledTitle}</strong>,
              where: <em>{t.disabledWhere}</em>,
            })}
          </span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="analytics-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">{t.totalViews}</span>
          <span className="metric-value">{totalViews.toLocaleString()}</span>
          <span className="metric-sub">{t.lifetime}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">{t.activeDays}</span>
          <span className="metric-value">{Object.keys(data.days || {}).length}</span>
          <span className="metric-sub">{t.daysRecorded}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">{t.devices}</span>
          <span className="metric-value">
            {desktopRatio}% / {100 - desktopRatio}%
          </span>
          <span className="metric-sub">{t.deviceSplit}</span>
        </div>
      </div>

      {/* Daily Trends Chart */}
      <div className="analytics-panel">
        <div className="analytics-section-title">
          <h3>
            <Icons.IconGrid size={16} /> {t.dailyTrend}
          </h3>
        </div>
        {!hasDays ? (
          <p className="analytics-empty">{t.noViews}</p>
        ) : (
          <div className="analytics-bar-chart">
            {daysList.map(({ date, pageviews }) => {
              const heightPct = Math.round((pageviews / maxDayViews) * 100);
              const month = date.slice(5, 8); // "MM-"
              const day = date.slice(8); // "DD"
              return (
                <div key={date} className="bar-col" title={t.dayViews(date, pageviews)}>
                  <div className="bar-wrapper">
                    {/* A day with views keeps a sliver of bar; an empty one has none. */}
                    <div
                      className="bar-fill"
                      style={{ height: `${pageviews > 0 ? Math.max(heightPct, 3) : 0}%` }}
                    >
                      <span className="bar-val">{pageviews}</span>
                    </div>
                  </div>
                  <span className="bar-label">
                    {/* Hidden at phone width, where only the day fits (A-18). */}
                    <span className="bar-label-month">{month}</span>
                    {day}
                  </span>
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
            <Icons.IconTarget size={16} /> {t.topPages}
          </h3>
        </div>
        {data.topPages.length === 0 ? (
          <p className="analytics-empty">{t.noPages}</p>
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
                      <span className="page-count">{t.pageViews(p.count)}</span>
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
