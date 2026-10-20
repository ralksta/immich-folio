'use client';

/**
 * /admin: the first screen after signing in (docs/admin-ux-concept.md).
 *
 * Says what needs attention before it is asked for (unread messages, doctor
 * findings), then the site at a glance. Everything on it links to the screen
 * where it is acted on. It only reads the existing admin endpoints; a failed
 * one leaves its part out rather than failing the page.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icons from './Icons';
import { adminGet } from './useAdminFetch';
import type { DoctorFinding, DoctorLevel } from '@/lib/admin/doctor';
import { DOCTOR_LEVEL_EVENT } from './systemHealth';
import { parseGalleryYaml } from './page-builder/galleryYaml';
import { useAdminDictionary } from './AdminI18n';
import type { AdminDictionary } from '@/lib/i18n/admin';

interface OverviewData {
  /** gallery.yaml as stored; `subpages` may be a list or the older name → albums map. */
  gallery: Record<string, unknown> | null;
  journal: Array<{ frontmatter: { draft?: boolean } }> | null;
  messages: Array<{ read: boolean; name: string }> | null;
  analytics: { days?: Record<string, { pageviews?: number }> } | null;
  doctor: { level: DoctorLevel; findings: DoctorFinding[] } | null;
}

/** Where a doctor finding is fixed; mirrors FIXES in DiagnosticsView. */
const FIX_ROUTE: Record<string, string> = {
  legal: '/admin/settings/legal',
  contact: '/admin/settings/legal',
  privacy: '/admin/settings/legal',
  passwords: '/admin/settings/security',
  'album-ids': '/admin/pages',
  'albums-shared': '/admin/pages',
  'content-pages': '/admin/pages',
};

function viewsLastDays(
  days: Record<string, { pageviews?: number }> | undefined,
  n: number,
): number {
  if (!days) return 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (n - 1));
  const from = cutoff.toISOString().slice(0, 10);
  return Object.entries(days)
    .filter(([date]) => date >= from)
    .reduce((sum, [, d]) => sum + (d.pageviews || 0), 0);
}

function greeting(t: AdminDictionary['shell']['overview']): string {
  const h = new Date().getHours();
  if (h < 5) return t.goodNight;
  if (h < 12) return t.goodMorning;
  if (h < 18) return t.goodAfternoon;
  return t.goodEvening;
}

export default function AdminOverview() {
  const t = useAdminDictionary().shell.overview;
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      adminGet<{ gallery: OverviewData['gallery'] }>('/api/admin/gallery'),
      adminGet<{ entries: NonNullable<OverviewData['journal']> }>('/api/admin/journal'),
      adminGet<{ messages: NonNullable<OverviewData['messages']> }>('/api/admin/messages'),
      adminGet<NonNullable<OverviewData['analytics']>>('/api/admin/analytics'),
      adminGet<NonNullable<OverviewData['doctor']>>('/api/admin/doctor'),
    ]).then(([gallery, journal, messages, analytics, doctor]) => {
      if (!live) return;
      setData({
        gallery: gallery.data?.gallery ?? null,
        journal: journal.data?.entries ?? null,
        messages: messages.data?.messages ?? null,
        analytics: analytics.data ?? null,
        doctor: doctor.data ?? null,
      });
      // The sidebar badge takes the level from here instead of asking again.
      if (doctor.data?.level) {
        window.dispatchEvent(new CustomEvent(DOCTOR_LEVEL_EVENT, { detail: doctor.data.level }));
      }
    });
    return () => {
      live = false;
    };
  }, []);

  // Read the way the page builder reads it: both shapes of `subpages:`, and
  // `- page:` entries, which are content pages in the menu, not subpages (#722).
  const subpages = data?.gallery ? parseGalleryYaml(data.gallery).subpages : [];
  const published = subpages.filter((sp) => sp.enabled !== false).length;
  const heroRaw = data?.gallery?.hero;
  const heroCount = Array.isArray(heroRaw) ? heroRaw.length : heroRaw ? 1 : 0;
  const entries = data?.journal ?? [];
  const drafts = entries.filter((e) => e.frontmatter.draft).length;
  const unread = (data?.messages ?? []).filter((m) => !m.read);
  const views7 = viewsLastDays(data?.analytics?.days, 7);
  const findings = (data?.doctor?.findings ?? []).filter((f) => f.level !== 'ok');

  const attention: Array<{
    tone: 'accent' | 'warn' | 'error';
    title: string;
    detail?: string;
    href: string;
  }> = [];
  if (unread.length) {
    attention.push({
      tone: 'accent',
      title: t.unreadMessages(unread.length),
      detail: t.from([...new Set(unread.map((m) => m.name))].slice(0, 3).join(', ')),
      href: '/admin/messages',
    });
  }
  for (const f of findings) {
    attention.push({
      tone: f.level === 'error' ? 'error' : 'warn',
      title: f.title,
      detail: f.detail,
      href: FIX_ROUTE[f.id] ?? '/admin/diagnostics',
    });
  }

  return (
    <div className="admin-overview">
      <header className="overview-head">
        <div>
          <p className="overview-kicker">{t.kicker}</p>
          <h1 className="overview-title">{greeting(t)}.</h1>
          <p className="overview-sub">
            {data ? (attention.length ? t.needsLook(attention.length) : t.allInOrder) : t.checking}
          </p>
        </div>
        <div className="overview-actions">
          <a
            className="admin-btn admin-btn-ghost"
            href="/?fresh=1"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icons.IconLink size={14} /> {t.viewSite}
          </a>
          <Link className="admin-btn admin-btn-primary" href="/admin/pages">
            <Icons.IconPencil size={14} /> {t.editPages}
          </Link>
        </div>
      </header>

      <section aria-labelledby="overview-attention">
        <h2 id="overview-attention" className="overview-section-label">
          {t.attention}
        </h2>
        {!data ? (
          <div className="admin-spinner" />
        ) : attention.length ? (
          <div className="overview-attention">
            {attention.map((a, i) => (
              <Link key={i} href={a.href} className="overview-attention-item">
                <span className={`overview-attention-marker ${a.tone}`} aria-hidden="true" />
                <span className="overview-attention-text">
                  {a.title}
                  {a.detail && <span className="overview-attention-detail">{a.detail}</span>}
                </span>
                <span className="overview-attention-go">{t.open}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="overview-calm">{t.calm}</p>
        )}
      </section>

      <section aria-labelledby="overview-glance">
        <h2 id="overview-glance" className="overview-section-label">
          {t.glance}
        </h2>
        <div className="overview-stats">
          <Link href="/admin/pages" className="overview-stat">
            <span className="overview-stat-label">{t.pages}</span>
            <span className="overview-stat-value">{data ? published : '–'}</span>
            <span className="overview-stat-note">
              {subpages.length - published > 0
                ? t.switchedOff(subpages.length - published)
                : t.allPublished}
            </span>
          </Link>
          <Link href="/admin/pages" className="overview-stat">
            <span className="overview-stat-label">{t.heroPhotos}</span>
            <span className="overview-stat-value">{data ? heroCount : '–'}</span>
            <span className="overview-stat-note">{t.onHomePage}</span>
          </Link>
          <Link href="/admin/journal" className="overview-stat">
            <span className="overview-stat-label">{t.journal}</span>
            <span className="overview-stat-value">{data ? entries.length : '–'}</span>
            <span className="overview-stat-note">{drafts ? t.drafts(drafts) : t.noDrafts}</span>
          </Link>
          <Link href="/admin/analytics" className="overview-stat">
            <span className="overview-stat-label">{t.views7}</span>
            <span className="overview-stat-value">{data ? views7.toLocaleString() : '–'}</span>
            <span className="overview-stat-note">{t.cookieless}</span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="overview-next">
        <h2 id="overview-next" className="overview-section-label">
          {t.quickActions}
        </h2>
        <div className="overview-actions">
          <Link className="admin-btn admin-btn-ghost" href="/admin/journal">
            <Icons.IconPlus size={14} /> {t.newEntry}
          </Link>
          <Link className="admin-btn admin-btn-ghost" href="/admin/messages">
            <Icons.IconFileText size={14} /> {t.messages}
          </Link>
          <Link className="admin-btn admin-btn-ghost" href="/admin/settings/theme">
            <Icons.IconPalette size={14} /> {t.theme}
          </Link>
          <Link className="admin-btn admin-btn-ghost" href="/admin/diagnostics">
            <Icons.IconShieldCheck size={14} /> {t.diagnostics}
          </Link>
        </div>
      </section>
    </div>
  );
}
