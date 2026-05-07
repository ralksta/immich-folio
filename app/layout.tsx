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
import { SetupScreen } from '@/components/SetupScreen';
import { getConfig, getGoogleFontsUrl, AppConfig } from '@/lib/config';
// DevToolbarLoader is a Client Component (ssr: false is only allowed there)
import { DevToolbarLoader } from '@/components/DevToolbarLoader';

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
          <SetupScreen />
        </body>
      </html>
    );
  }

  return (
    <html
      lang={config.lang || 'en'}
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
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
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
        <main id="main-content" tabIndex={-1} className="main">
          {children}
        </main>
        <Footer />
        <ScrollToTop />
        {process.env.NODE_ENV === 'development' && <DevToolbarLoader />}
      </body>
    </html>
  );
}
