import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import manifest from "./motomate-accessory-assets.json" with { type: "json" };

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSET_ROOT = path.join(ROOT, "public", "motomate", "accessories", "assets");
const CONCURRENCY = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function targetPath(relativePath) {
  const resolved = path.resolve(ROOT, relativePath);
  if (!resolved.startsWith(`${ASSET_ROOT}${path.sep}`)) {
    throw new Error(`Unsafe asset path: ${relativePath}`);
  }
  return resolved;
}

function validateSourceUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "http:"
    || url.hostname !== "motomate.cn"
    || url.port !== "58183"
    || !url.pathname.startsWith("/tools/PC/assets/")) {
    throw new Error(`Untrusted source URL: ${sourceUrl}`);
  }
  return url;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validateAsset(buffer, asset) {
  if (buffer.length !== asset.bytes) throw new Error(`unexpected size ${buffer.length}`);
  if (buffer.length > MAX_FILE_BYTES) throw new Error(`file exceeds ${MAX_FILE_BYTES} bytes`);
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("response is not a PNG image");
  }
  if (sha256(buffer) !== asset.sha256) throw new Error("SHA-256 mismatch");
}

async function isExistingAsset(filePath, asset) {
  try {
    const buffer = await readFile(filePath);
    validateAsset(buffer, asset);
    return true;
  } catch {
    return false;
  }
}

async function download(asset) {
  const destination = targetPath(asset.localPath);
  const sourceUrl = validateSourceUrl(asset.sourceUrl);
  if (await isExistingAsset(destination, asset)) return "cached";

  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  try {
    const response = await fetch(sourceUrl, { redirect: "error" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) {
      throw new Error(`file exceeds ${MAX_FILE_BYTES} bytes`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    validateAsset(buffer, asset);
    await writeFile(temporary, buffer);
    await rename(temporary, destination);
    return "downloaded";
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw new Error(`${asset.sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let cursor = 0;
let downloaded = 0;
let cached = 0;
const failures = [];

async function worker() {
  while (cursor < manifest.assets.length) {
    const index = cursor;
    cursor += 1;
    const asset = manifest.assets[index];
    try {
      const result = await download(asset);
      if (result === "downloaded") downloaded += 1;
      else cached += 1;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

if (failures.length > 0) {
  console.error(`Accessory asset sync failed for ${failures.length} file(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Accessory assets ready: ${downloaded} downloaded, ${cached} cached, ${manifest.assets.length} total.`);
}
