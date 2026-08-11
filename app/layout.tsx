/**
 * Root layout — site header with portfolio-style navigation.
 * Shows all subpages + standalone albums as nav links.
 * Injects theme CSS custom properties from gallery.yaml config.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import './globals.css';
import { SubpageNav } from '@/components/SubpageNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ScrollToTop } from '@/components/ScrollToTop';
import { Footer } from '@/components/Footer';
import { SetupScreen } from '@/components/SetupScreen';
import { getConfigOrNull, getGoogleFontsUrl, AppConfig } from '@/lib/config';
import { isAdminPath } from '@/lib/admin/paths';
import { isInstallPath } from '@/lib/install';
// DevToolbarLoader is a Client Component (ssr: false is only allowed there)
import { DevToolbarLoader } from '@/components/DevToolbarLoader';
import AssetProtection from '@/components/AssetProtection';
import AnalyticsTracker from '@/components/AnalyticsTracker';

export async function generateMetadata(): Promise<Metadata> {
  const config = getConfigOrNull();
  if (!config) {
    // Nothing to describe, and nothing that should be indexed while broken.
    return {
      title: 'Setup Required',
      robots: { index: false, follow: false },
      icons: { icon: '/api/favicon' },
    };
  }

  const siteTitle = config.seo.title;
  const siteDescription = config.seo.description;
  const robots = {
    index: !config.seo.noIndex,
    follow: !config.seo.noFollow,
  };

  return {
    title: {
      default: siteTitle,
      template: config.seo.titleTemplate,
    },
    description: siteDescription,
    robots,
    icons: {
      icon: '/api/favicon',
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getConfigOrNull();
  const pathname = (await headers()).get('x-pathname');

  // gallery.yaml exists but cannot be derived — an empty gallery, a nameless
  // subpage, a subpage with no albums. The admin page builder can write all
  // three, and this layout is what /admin renders inside, so throwing here
  // would take down the only tool that can undo the save. Render the minimum
  // that keeps /admin usable and show everyone else the setup screen.
  if (!config) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body>{isAdminPath(pathname) || isInstallPath(pathname) ? children : <SetupScreen />}</body>
      </html>
    );
  }

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

  // /admin and /install stay reachable during setup — /admin is the tool that
  // completes an existing setup, /install is the wizard that performs the first
  // one, so the setup screen must not lock either of them out (#326).
  if ((config as AppConfig & { needsSetup?: boolean }).needsSetup && !isAdminPath(pathname) && !isInstallPath(pathname)) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body>
          <SetupScreen />
        </body>
      </html>
    );
  }

  const isAdmin = isAdminPath(pathname);

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
        {isAdmin ? (
          children
        ) : (
          <>
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            <header className="header">
              <nav className="header__nav">
                {/* Brand wordmark — presets that show it pair it with the dot. */}
                <span className="header__wordmark" aria-hidden="true">
                  {config.siteTitle}
                </span>
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
            <AssetProtection
              disableRightClick={config.protection?.disableRightClick}
              disableImageDrag={config.protection?.disableImageDrag}
            />
            <AnalyticsTracker />
            {process.env.NODE_ENV === 'development' && <DevToolbarLoader />}
          </>
        )}
      </body>
    </html>
  );
}
