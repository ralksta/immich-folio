'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * A header link that knows whether it is the page you are on.
 *
 * `.header__nav-link.active` has been styled in globals.css since the header
 * was written, but nothing ever applied the class — the nav looked like it
 * should tell you where you are, and did not. `aria-current` was missing with
 * it, so screen-reader users had no equivalent either.
 *
 * Matching: exact for `/`, and prefix-with-separator for everything else, so an
 * album at `/reisen/island` marks its subpage `/reisen` without `/reise` also
 * matching `/reisen`. External links are rendered by the caller as plain
 * anchors and never take part.
 */
export function NavLink({
  href,
  children,
  className = 'header__nav-link',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      className={active ? `${className} active` : className}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}

/** Exported for tests: whether `href` is the section `pathname` sits in. */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
