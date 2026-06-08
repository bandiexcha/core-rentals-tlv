import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
      },
      {
        protocol: "https",
        hostname: "web-api.maveriks.com",
      },
      {
        protocol: "https",
        hostname: "static.guesty.com",
      },
    ],
  },
};

export default nextConfig;
