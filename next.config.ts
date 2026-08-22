import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.gm.com",
        pathname: "/content/dam/Shared/Images/Logos/gm/**",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "www.gloskinbeauty.com",
        pathname: "/cdn/shop/files/**",
      },
    ],
  },
};

export default nextConfig;
