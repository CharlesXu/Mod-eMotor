import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  basePath,
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  output: isGitHubPages ? "export" : "standalone",
  trailingSlash: isGitHubPages,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
