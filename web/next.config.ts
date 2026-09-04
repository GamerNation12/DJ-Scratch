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
      },
      {
        // NOTE: "*" + Allow-Credentials is an invalid combo browsers reject.
        // Same scoped origin as vercel.json; same-origin frontend needs no CORS.
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://dj-scratch.vercel.app" },
          { key: "Vary", value: "Origin" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ];
  },
};

export default nextConfig;
