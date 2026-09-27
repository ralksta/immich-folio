/**
 * BackLink — reusable "← Back to X" navigation link.
 * Used in album headers to navigate back to a parent subpage or homepage.
 */

import Link from 'next/link';

interface BackLinkProps {
  href: string;
  label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    // No aria-label: every caller's label already reads "Back to …", and an
    // aria-label built from it announced "Back to Back to …".
    <Link href={href} className="album-header__back">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </Link>
  );
}
