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
      {
        protocol: "https",
        hostname: "assets.guesty.com",
      },
      {
        protocol: "https",
        hostname: "oczbmewo4o86denx.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
