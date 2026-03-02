import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Add cache busting for static assets
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
  // Force new build ID on each deployment
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Add headers for cache control
  async headers() {
    return [
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
