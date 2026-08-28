import type { NextConfig } from "next";

const upgradeInsecureRequests = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')
  ? '; upgrade-insecure-requests'
  : '';

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [],
  },
  // Add cache busting for static assets
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
  // Force new build ID on each deployment
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Add headers for cache control
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'${upgradeInsecureRequests}`,
          },
        ],
      },
      {
        source: '/:all*(svg|jpg|png|css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
