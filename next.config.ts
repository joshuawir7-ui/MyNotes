import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
    webpackMemoryOptimizations: true,
    serverComponentsHmrCache: true,
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "react-virtuoso",
    ],
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
