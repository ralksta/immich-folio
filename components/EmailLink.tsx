'use client';

/**
 * A mailto: link whose address is only put together in the browser; see
 * lib/emailObfuscation.ts.
 *
 * Until hydration there is no address and no href. A page that must keep the
 * address reachable without JavaScript (the Impressum) renders its own
 * <noscript> with spelledOutEmail(). That is not a prop here: props travel in
 * the RSC payload, so even an unused fallback would land in every page.
 */

import { useSyncExternalStore, type ReactNode } from 'react';
import { decodeEmail } from '@/lib/emailObfuscation';

interface Props {
  /** encodeEmail() of the address. */
  encoded: string;
  className?: string;
  'aria-label'?: string;
  /** Link content, e.g. an icon. Without it the address itself is shown. */
  children?: ReactNode;
}

const subscribe = () => () => {};

export default function EmailLink({ encoded, className, children, ...rest }: Props) {
  // False on the server and during hydration, true afterwards: the decoded
  // address never appears in server HTML and never causes a mismatch.
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const email = inBrowser ? decodeEmail(encoded) : '';

  return (
    <a
      href={email ? `mailto:${email}` : undefined}
      className={className}
      aria-label={rest['aria-label']}
    >
      {children ?? email}
    </a>
  );
}
