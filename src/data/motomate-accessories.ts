export const ACCESSORY_CATEGORIES = [
  { id: "frontSuspension", label: "前减震", placeholder: "前减" },
  { id: "backSuspension", label: "后减震", placeholder: "后减" },
  { id: "hubFront", label: "轮毂", placeholder: "轮毂" },
  { id: "hubMotor", label: "电机", placeholder: "电机" },
  { id: "secondBody", label: "平叉", placeholder: "平叉" },
  { id: "calipers", label: "卡钳", placeholder: "卡钳" },
  { id: "disc", label: "碟片", placeholder: "碟片" },
] as const;

export type AccessoryCategoryId = (typeof ACCESSORY_CATEGORIES)[number]["id"];

export type AccessoryRecord = Readonly<{
  id: string;
  name: string;
  brand: string;
  type: AccessoryCategoryId;
  concise: string;
}>;

export const MOTOMATE_ACCESSORIES: readonly AccessoryRecord[] = [
  { id: "front-zqq-f2-400", name: "幽影 F2（400）", brand: "ZQQ", type: "frontSuspension", concise: "46芯；400mm" },
  { id: "front-zqq-f2-420", name: "幽影 F2（420）", brand: "ZQQ", type: "frontSuspension", concise: "46芯；420mm" },
  { id: "front-olaoshi-as2-400", name: "AS2（400）", brand: "OLAOSHI", type: "frontSuspension", concise: "31芯；400mm" },
  { id: "front-olaoshi-as2-31", name: "AS2 31芯", brand: "OLAOSHI", type: "frontSuspension", concise: "31芯；400mm" },

  { id: "back-zqq-r3-290", name: "蝰蛇 R3（290）", brand: "ZQQ", type: "backSuspension", concise: "290mm" },
  { id: "back-zqq-r3-330", name: "蝰蛇 R3（330）", brand: "ZQQ", type: "backSuspension", concise: "330mm" },
  { id: "back-olaoshi-et-265", name: "ET（265）", brand: "OLAOSHI", type: "backSuspension", concise: "265mm" },
  { id: "back-olaoshi-et-310", name: "ET（310）", brand: "OLAOSHI", type: "backSuspension", concise: "310mm；另有 290/330mm" },

  { id: "hub-hh-fire-12", name: "火影 12in", brand: "HH", type: "hubFront", concise: "12in；2.5J" },
  { id: "hub-hh-fire-25j", name: "火影 2.5J", brand: "HH", type: "hubFront", concise: "12in；2.5J" },
  { id: "hub-olaoshi-ckz-12", name: "CKZ 12in", brand: "OLAOSHI", type: "hubFront", concise: "12in；2.5J" },
  { id: "hub-olaoshi-ckz-25j", name: "CKZ 2.5J", brand: "OLAOSHI", type: "hubFront", concise: "12in；2.5J" },

  { id: "motor-qs-interstellar-3000", name: "星际 3000w", brand: "QSMOTOR", type: "hubMotor", concise: "3000w；12in" },
  { id: "motor-qs-interstellar-12", name: "星际 12in", brand: "QSMOTOR", type: "hubMotor", concise: "3000w；12in" },
  { id: "motor-qs-gen4-3000", name: "4代电机 3000w", brand: "QSMOTOR", type: "hubMotor", concise: "3000w；12in" },
  { id: "motor-qs-gen4-12", name: "4代电机 12in", brand: "QSMOTOR", type: "hubMotor", concise: "3000w；12in" },

  { id: "swing-qs-v-430", name: "V型中置（430）", brand: "QSMOTOR", type: "secondBody", concise: "430孔距" },
  { id: "swing-qs-v-center", name: "V型中置平叉", brand: "QSMOTOR", type: "secondBody", concise: "中置结构；430孔距" },
  { id: "swing-qs-90-340", name: "90中置平叉（340）", brand: "QSMOTOR", type: "secondBody", concise: "340孔距" },
  { id: "swing-qs-90-center", name: "90中置平叉", brand: "QSMOTOR", type: "secondBody", concise: "中置结构；340孔距" },

  { id: "caliper-brembo-gp4-108", name: "GP4-RX（108）", brand: "Brembo", type: "calipers", concise: "108锁点；对置四活塞" },
  { id: "caliper-brembo-gp4-four", name: "GP4-RX 四活塞", brand: "Brembo", type: "calipers", concise: "对置四活塞；108锁点" },
  { id: "caliper-brembo-m432-100", name: "M4.32（100）", brand: "Brembo", type: "calipers", concise: "100锁点；对置四活塞" },
  { id: "caliper-brembo-m432-four", name: "M4.32 四活塞", brand: "Brembo", type: "calipers", concise: "对置四活塞；100锁点" },

  { id: "disc-morogo-cyclone-220", name: "旋风（220）", brand: "MOROGO", type: "disc", concise: "固定盘；220mm" },
  { id: "disc-morogo-cyclone-fixed", name: "旋风固定盘", brand: "MOROGO", type: "disc", concise: "固定盘；220mm" },
  { id: "disc-morogo-cannon-245", name: "小钢炮（245）", brand: "MOROGO", type: "disc", concise: "固定盘；245mm" },
  { id: "disc-morogo-cannon-fixed", name: "小钢炮固定盘", brand: "MOROGO", type: "disc", concise: "固定盘；245mm" },
] as const;
