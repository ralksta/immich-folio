import Link from 'next/link';
import { IconRefresh } from './Icons';

interface AdminDiagnosticBannerProps {
  slug: string;
  subpageName?: string;
  configuredAlbumCount?: number;
  reason?: string;
}

export function AdminDiagnosticBanner({
  slug,
  subpageName,
  configuredAlbumCount = 0,
  reason,
}: AdminDiagnosticBannerProps) {
  return (
    <div
      style={{
        maxWidth: '680px',
        margin: '60px auto',
        padding: '24px',
        borderRadius: '12px',
        backgroundColor: '#1c1c1e',
        border: '1px solid #333336',
        color: '#f2f2f7',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px' }}>⚠️</span>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#ffd60a' }}>
          Admin Diagnostic: Subpage loaded with 0 photos
        </h2>
      </div>

      <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#aeaeb2', margin: '0 0 16px 0' }}>
        The subpage <strong>/{slug}</strong> {subpageName ? `("${subpageName}")` : ''} is active in{' '}
        <code style={{ background: '#2c2c2e', padding: '2px 6px', borderRadius: '4px' }}>
          gallery.yaml
        </code>
        {configuredAlbumCount > 0 ? `, and configured with ${configuredAlbumCount} album(s)` : ''},
        but Immich returned no accessible albums or assets.
      </p>

      {reason && (
        <div
          style={{
            background: '#2c2c2e',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#ff9f0a',
            marginBottom: '16px',
          }}
        >
          {reason}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f2f2f7' }}>
          Possible Causes & Checklist:
        </h4>
        <ul
          style={{
            margin: 0,
            paddingLeft: '20px',
            fontSize: '13px',
            color: '#d1d1d6',
            lineHeight: 1.8,
          }}
        >
          <li>
            <strong>Album Shared Status in Immich:</strong> Ensure the album in Immich is marked as{' '}
            <strong>Shared (Geteilt)</strong>. Unshared albums are excluded by Immich Folio for
            security.
          </li>
          <li>
            <strong>Cache Lag:</strong> If you just added the album or changed permissions, click{' '}
            <em>Force Reload Fresh</em> below.
          </li>
          <li>
            <strong>Album UUID:</strong> Check if the album UUID in your Page Builder matches the
            exact Immich Album ID.
          </li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <a
          href={`/${slug}?fresh=1`}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#0a84ff',
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <IconRefresh size={14} aria-hidden="true" /> Force Reload Fresh (?fresh=1)
        </a>
        <Link
          href="/admin"
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#2c2c2e',
            color: '#f2f2f7',
            border: '1px solid #3a3a3c',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ⚙️ Open Page Builder (/admin)
        </Link>
        <Link
          href="/"
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            color: '#8e8e93',
            textDecoration: 'none',
            fontSize: '13px',
          }}
        >
          Back to Gallery
        </Link>
      </div>
    </div>
  );
}
