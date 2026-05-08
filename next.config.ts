import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/twelvescricket",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
