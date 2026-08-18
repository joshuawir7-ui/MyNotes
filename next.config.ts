import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
    webpackMemoryOptimizations: true,
    serverComponentsHmrCache: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
