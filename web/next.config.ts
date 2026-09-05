import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: Next 16 removed the `eslint` key (and `next lint`); builds no
  // longer run ESLint, so there is nothing to ignore here anymore.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/invite',
        destination: 'https://discord.com/oauth2/authorize?client_id=1521582398188290049&permissions=347200&scope=bot%20applications.commands',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      afterFiles: [
        // Other rewrites can go here
      ]
    };
  },
  async headers() {
    // NOTE: CORS lives in middleware.ts (echoes the caller origin) so the
    // desktop app (app://), Activities, and both domains all work. Do NOT
    // set Allow-Origin here — duplicate values fail the browser check.
    return [
      {
        source: "/(.*).apk",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          {
            key: "Content-Disposition",
            value: "attachment",
          },
        ],
      }
    ];
  },
};

export default nextConfig;
