const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function publicPath(path: string): string {
  if (!basePath || !path.startsWith("/") || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}
