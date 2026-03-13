'use client';

import dynamic from 'next/dynamic';

// ssr: false ist nur in Client Components erlaubt
const DevToolbar = dynamic(
  () => import('@/components/DevToolbar').then((m) => ({ default: m.DevToolbar })),
  { ssr: false },
);

export function DevToolbarLoader() {
  return <DevToolbar />;
}
