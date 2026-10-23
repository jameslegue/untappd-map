import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Newer Untappd uploads only exist at full size; Vercel resizes + caches them
    remotePatterns: [{ protocol: "https", hostname: "untappd.s3.amazonaws.com" }],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
};

export default nextConfig;
