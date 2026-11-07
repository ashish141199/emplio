import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  devIndicators: false,
};

export default nextConfig;
