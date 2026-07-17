import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import accessoryData from "../src/data/motomate-accessories.json" with { type: "json" };
import assetManifest from "../scripts/motomate-accessory-assets.json" with { type: "json" };

const ROOT = path.resolve(import.meta.dirname, "..");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

const EXPECTED_COUNTS = {
  photo: {
    hubFront: 77,
    hubMotor: 44,
    calipers: 169,
    disc: 65,
    frontSuspension: 86,
    backSuspension: 77,
    secondBody: 160,
    fenderFront: 5,
    fenderBack: 4,
    tire: 14,
  },
  sketch: {
    secondBody: 26,
    hubMotor: 8,
    hubFront: 7,
  },
};

function countByType(items) {
  return Object.fromEntries(
    Object.entries(Object.groupBy(items, (item) => item.type)).map(([key, values]) => [
      key,
      values.length,
    ]),
  );
}

test("contains the complete photo and sketch catalog from the reference site", () => {
  const photos = accessoryData.items.filter((item) => item.kind === "photo");
  const sketches = accessoryData.items.filter((item) => item.kind === "sketch");

  assert.equal(accessoryData.photoCount, 701);
  assert.equal(accessoryData.sketchCount, 41);
  assert.equal(accessoryData.items.length, 742);
  assert.deepEqual(countByType(photos), EXPECTED_COUNTS.photo);
  assert.deepEqual(countByType(sketches), EXPECTED_COUNTS.sketch);
  assert.equal(new Set(accessoryData.items.map((item) => item.id)).size, 742);
});

test("maps every catalog image to the deduplicated local asset manifest", () => {
  const manifestPaths = new Set(
    assetManifest.assets.map((asset) => `/${asset.localPath.replace(/^public\//, "")}`),
  );
  const catalogPaths = new Set(
    accessoryData.items.flatMap((item) => [item.imageSrc1, item.imageSrc2]),
  );

  assert.equal(assetManifest.assets.length, 734);
  assert.equal(manifestPaths.size, 734);
  assert.equal(catalogPaths.size, 734);
  assert.deepEqual(catalogPaths, manifestPaths);
});

test("ships every accessory asset with the expected complete PNG checksum", async () => {
  await Promise.all(
    assetManifest.assets.map(async (asset) => {
      const filePath = path.resolve(ROOT, asset.localPath);
      assert.ok(filePath.startsWith(`${ROOT}${path.sep}public${path.sep}`));
      assert.equal((await stat(filePath)).size, asset.bytes, asset.localPath);
      const file = await readFile(filePath);
      assert.ok(file.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), asset.localPath);
      assert.ok(file.subarray(-PNG_IEND.length).equals(PNG_IEND), asset.localPath);
      assert.equal(createHash("sha256").update(file).digest("hex"), asset.sha256, asset.localPath);
    }),
  );
});
