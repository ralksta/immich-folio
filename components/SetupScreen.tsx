import React from 'react';

export function SetupScreen() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '2rem',
        backgroundColor: '#ffffff',
        color: '#111111',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 500,
            marginBottom: '0.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          Setup Required
        </h1>
        <p
          style={{
            fontSize: '1.125rem',
            opacity: 0.7,
            marginBottom: '2rem',
            lineHeight: 1.5,
          }}
        >
          Immich Folio is running, but it looks like your configuration files or environment
          variables are missing.
        </p>
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            padding: '1.5rem',
            borderRadius: '8px',
            fontSize: '0.95rem',
            lineHeight: 1.6,
          }}
        >
          <p style={{ marginBottom: '1rem' }}>
            The quickest way is the setup wizard at <code>/install</code>. It is gated by a one-time
            token printed to the server log at startup (<code>docker logs</code>) — append it as{' '}
            <code>?token=…</code>.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            Or configure it by hand, in your repository or mounted <code>content/</code> volume:
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Immich API
              URL and Key
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Copy <code>settings.yaml.example</code> to <code>settings.yaml</code>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Copy <code>gallery.yaml.example</code> to <code>gallery.yaml</code>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Copy <code>about.md.example</code> to <code>about.md</code> (optional)
            </li>
          </ol>
          <p style={{ marginTop: '1.5rem', marginBottom: 0 }}>
            Open <code>gallery.yaml</code> and add the album IDs you want to display, then{' '}
            <strong>restart your server</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
