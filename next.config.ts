import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Newer Untappd uploads only exist at full size; Vercel resizes + caches them
    remotePatterns: [{ protocol: "https", hostname: "untappd.s3.amazonaws.com" }],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  // The worker is a .cjs file (so MapLibre starts it as a classic worker), which
  // gets served as "application/node". Chrome runs it anyway; Safari refuses a
  // worker that isn't served as JavaScript ("Worker failed to load")
  async headers() {
    return [
      {
        source: "/maplibre/:file*",
        headers: [
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
          // Content-hashed filenames (scripts/build-maplibre.mjs) - safe to cache forever
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  // MapLibre compiled down for older Safari by scripts/build-maplibre.mjs (see there
  // for why this isn't transpilePackages). `$` = only the bare import, so
  // "maplibre-gl/dist/maplibre-gl.css" still resolves normally
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "maplibre-gl$": path.resolve(process.cwd(), ".generated/maplibre-gl.mjs"),
    };
    return config;
  },
};

export default nextConfig;
