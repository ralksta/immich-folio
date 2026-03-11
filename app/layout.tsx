/**
 * Root layout — site header with portfolio-style navigation.
 * Shows all subpages + standalone albums as nav links.
 * Injects theme CSS custom properties from gallery.yaml config.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { SubpageNav } from '@/components/SubpageNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ScrollToTop } from '@/components/ScrollToTop';
import { Footer } from '@/components/Footer';
import { DevToolbar } from '@/components/DevToolbar';
import { getConfig, getGoogleFontsUrl, AppConfig } from '@/lib/config';

export async function generateMetadata(): Promise<Metadata> {
  const config = getConfig();
  const siteTitle = config.seo.title;
  const siteDescription = config.seo.description;
  const robots = {
    index: !config.seo.noIndex,
    follow: !config.seo.noFollow,
  };

  return {
    title: siteTitle,
    description: siteDescription,
    robots,
    icons: {
      apple: '/apple-touch-icon.png',
    },
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      type: 'website',
      images: [`/api/og?title=${encodeURIComponent(siteTitle)}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteTitle,
      description: siteDescription,
      images: [`/api/og?title=${encodeURIComponent(siteTitle)}`],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getConfig();
  const { theme } = config;
  const fontsUrl = getGoogleFontsUrl(theme);

  const themeVars: Record<string, string> = {
    '--accent': theme.accent,
    '--accent-dim': `${theme.accent}1f`,
    '--font-serif': `'${theme.fonts.heading}', Georgia, 'Times New Roman', serif`,
    '--font-sans': `'${theme.fonts.body}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    '--font-caption': `'${theme.fonts.caption}', Georgia, serif`,
    '--radius-sm': `${theme.radius}px`,
    '--radius-md': `${Math.round(theme.radius * 1.5)}px`,
    '--radius-lg': `${theme.radius * 2}px`,
  };

  if ((config as AppConfig & { needsSetup?: boolean }).needsSetup) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body>
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
                  To get started, follow these steps in your repository or mounted{' '}
                  <code>content/</code> volume:
                </p>
                <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Copy <code>.env.example</code> to <code>.env.local</code> and fill in your
                    Immich API URL and Key
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
        </body>
      </html>
    );
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={themeVars as React.CSSProperties}
      data-preset={theme.preset}
      data-grain={String(theme.grain)}
      data-header-dot={String(theme.headerDot)}
      data-photo-frame={theme.photoFrame}
      data-transitions={String(config.transitions)}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontsUrl} />
      </head>
      <body>
        <header className="header">
          <nav className="header__nav">
            <Link href="/" className="header__nav-link">
              Home
            </Link>
            <SubpageNav />
            <Link href="/about" className="header__nav-link">
              About
            </Link>
            {config.map && (
              <Link href="/map" className="header__nav-link">
                Map
              </Link>
            )}
            <ThemeToggle />
          </nav>
        </header>
        <main className="main">{children}</main>
        <Footer />
        <ScrollToTop />
        {process.env.NODE_ENV === 'development' && <DevToolbar />}
      </body>
    </html>
  );
}
