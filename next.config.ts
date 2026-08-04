import type { NextConfig } from 'next';

/**
 * Static security headers, applied to every response including /api and static
 * assets, which the proxy does not cover.
 *
 * The Content-Security-Policy is deliberately NOT set here: it needs a
 * per-request nonce and is owned exclusively by proxy.ts. Keeping the two
 * layers disjoint avoids emitting the same header twice with conflicting
 * values, which browsers may resolve by ignoring the header altogether.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    loader: 'custom',
    loaderFile: './lib/immichLoader.ts',
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
