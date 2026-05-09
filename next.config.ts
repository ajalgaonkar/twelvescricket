import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cricclubs.com",
      },
    ],
  },
};

export default nextConfig;
