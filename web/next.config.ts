import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        // Safe defaults for every response. Frame-related headers are left
        // alone because Discord Activities intentionally embed the site.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
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
