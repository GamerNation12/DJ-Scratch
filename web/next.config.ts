import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://discord.com https://*.discord.com https://*.discordsays.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
