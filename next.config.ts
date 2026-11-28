import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function getGitBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getBuildId() {
  if (process.env.NEXT_PUBLIC_BUILD_ID) return process.env.NEXT_PUBLIC_BUILD_ID;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev-local";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_BRANCH: process.env.NEXT_PUBLIC_GIT_BRANCH || getGitBranch(),
    NEXT_PUBLIC_BUILD_ID: getBuildId(),
  },
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
