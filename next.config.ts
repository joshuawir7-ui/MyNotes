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

/**
 * Dos builds desde el mismo código:
 * - Android/APK (por defecto): `output: "export"` estático en `out/`, SIN rutas de servidor.
 * - Web con servidor (Vercel, o `npm run dev:web|build:web|start:web`): sin export, y con la extensión
 *   extra `server.ts`, de modo que solo aquí existen los Route Handlers `src/app/api/** /route.server.ts`.
 */
const lifecycle = process.env.npm_lifecycle_event || "";
const isWebServerBuild =
  process.env.MYNOTES_WEB_SERVER === "1" || process.env.VERCEL === "1" || /:web$/.test(lifecycle);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_BRANCH: process.env.NEXT_PUBLIC_GIT_BRANCH || getGitBranch(),
    NEXT_PUBLIC_BUILD_ID: getBuildId(),
  },
  ...(isWebServerBuild ? {} : { output: "export" as const }),
  pageExtensions: isWebServerBuild ? ["tsx", "ts", "jsx", "js", "server.ts"] : ["tsx", "ts", "jsx", "js"],
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
