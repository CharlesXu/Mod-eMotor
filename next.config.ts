import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function isPrivateIpv4(address: string) {
  const [first, second] = address.split(".").map(Number);
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254);
}

function getAllowedDevOrigins() {
  const localAddresses = Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter(({ address, family, internal }) => (
      family === "IPv4" && !internal && isPrivateIpv4(address)
    ))
    .map(({ address }) => address);
  const configuredAddresses = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => Boolean(origin) && !/[/:]/.test(origin));

  return [...new Set([...localAddresses, ...configuredAddresses])];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
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
