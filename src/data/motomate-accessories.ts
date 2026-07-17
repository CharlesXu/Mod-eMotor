import accessoryCatalog from "./motomate-accessories.json";

export const ACCESSORY_CATEGORIES = [
  { id: "frontSuspension", label: "前减震" },
  { id: "backSuspension", label: "后减震" },
  { id: "hubFront", label: "前轮毂" },
  { id: "hubMotor", label: "轮毂电机" },
  { id: "secondBody", label: "平叉" },
  { id: "calipers", label: "卡钳" },
  { id: "disc", label: "碟片" },
  { id: "fenderFront", label: "前挡泥板" },
  { id: "fenderBack", label: "后挡泥板" },
  { id: "tire", label: "轮胎" },
] as const;

export const ACCESSORY_GALLERIES = [
  { id: "photo", label: "配件图片", count: 701 },
  { id: "sketch", label: "线条图", count: 41 },
] as const;

export type AccessoryCategoryId = (typeof ACCESSORY_CATEGORIES)[number]["id"];
export type AccessoryGalleryId = (typeof ACCESSORY_GALLERIES)[number]["id"];

export type AccessoryRecord = Readonly<{
  id: string;
  kind: AccessoryGalleryId;
  name: string;
  brand: string;
  type: AccessoryCategoryId;
  size: string;
  position: string | number;
  positionY: string | number;
  concise: string;
  describe: string;
  used: string;
  imageSrc1: string;
  imageSrc2: string;
  sourcePath1: string;
  sourcePath2: string;
}>;

export type AccessoryCatalog = Readonly<{
  source: string;
  sourceUrl: string;
  photoCount: number;
  sketchCount: number;
  items: readonly AccessoryRecord[];
}>;

export const MOTOMATE_ACCESSORY_CATALOG = accessoryCatalog as unknown as AccessoryCatalog;
export const MOTOMATE_ACCESSORIES = MOTOMATE_ACCESSORY_CATALOG.items;
