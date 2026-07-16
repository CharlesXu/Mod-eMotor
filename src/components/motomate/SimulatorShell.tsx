"use client";

import { useMemo, useState } from "react";

import catalogData from "@/data/motomate-catalog.json";
import mechanicalProfileData from "@/data/motomate-mechanical-profiles.json";
import photoAssetData from "@/data/motomate-photo-assets.json";
import { ControlSidebar, type SimulatorValues } from "./ControlSidebar";
import MotorCanvas from "./MotorCanvas";
import VehicleSelector, { type VehicleModel } from "./VehicleSelector";

const catalog = catalogData as readonly Readonly<{
  brand: string;
  models: readonly VehicleModel[];
}>[];
const mechanicalProfiles = mechanicalProfileData as Readonly<Record<string, Readonly<{
  defaults: Partial<SimulatorValues>;
}>>>;
const photoAssets: Readonly<Record<string, string>> = photoAssetData;
const storageKeyPrefix = "mod-emotor:simulator:";

const initialValues: SimulatorValues = {
  handlebarHeight: 97,
  handlebarAngle: 0,
  tripleClampAngle: 0,
  tripleClampDrop: 0,
  frontForkTravel: 425,
  frontWheelPosition: "中位",
  frontForkStyle: "正常",
  frontForkAirbag: "无",
  frontTireWidth: 90,
  frontTireRatio: 80,
  frontWheelDiameter: 14,
  frontWheelOffset: 0,
  frontBrakeDiscDiameter: 220,
  frontCaliperPosition: "前置",
  frontFender: "长",
  swingarmLength: 440,
  rearShockTravel: 260,
  rearShockAngle: 0,
  rearShockAirbag: "无",
  rearTireWidth: 90,
  rearTireRatio: 90,
  rearWheelDiameter: 14,
  rearWheelOffset: 0,
  rearBrakeDiscDiameter: 180,
  rearCaliperPosition: "后置",
  rearFender: "长",
  accessory: "无",
  paint: "原厂",
  seatHeight: 794,
  seatOffset: 0,
  footrestOffset: 0,
  riderHeight: 170,
  posture: "标准",
};

type SavedSimulator = Readonly<{
  brand: string;
  model: string;
  values: SimulatorValues;
}>;

const numericBounds: Readonly<Partial<Record<keyof SimulatorValues, readonly [number, number]>>> = {
  handlebarHeight: [20, 300], handlebarAngle: [-65, 65], tripleClampAngle: [-20, 20],
  tripleClampDrop: [-100, 180], frontForkTravel: [240, 700], frontTireWidth: [40, 220],
  frontTireRatio: [20, 120], frontWheelDiameter: [8, 24], frontWheelOffset: [-80, 80],
  frontBrakeDiscDiameter: [80, 420], swingarmLength: [280, 700], rearShockTravel: [140, 500],
  rearShockAngle: [-45, 45], rearTireWidth: [40, 220], rearTireRatio: [20, 120],
  rearWheelDiameter: [8, 24], rearWheelOffset: [-80, 80], rearBrakeDiscDiameter: [80, 420],
  seatHeight: [520, 1050], seatOffset: [-250, 250], footrestOffset: [-250, 250], riderHeight: [140, 210],
};

const choiceValues: Readonly<Partial<Record<keyof SimulatorValues, readonly string[]>>> = {
  frontWheelPosition: ["前位", "中位", "后位"], frontForkStyle: ["正常", "倒置"],
  frontForkAirbag: ["无", "P1", "P2"], frontCaliperPosition: ["前置", "后置"],
  frontFender: ["无", "短", "长"], rearCaliperPosition: ["前置", "后置"],
  rearFender: ["无", "短", "长"], rearShockAirbag: ["无", "P1", "P2", "P3"],
  accessory: ["无", "尾箱", "风挡"],
  paint: ["原厂", "亮黑", "哑光"], posture: ["标准", "运动", "舒适"],
};

function modelDefaults(brand: string, modelName: string): SimulatorValues {
  const extractedDefaults = mechanicalProfiles[`${brand}/${modelName}`]?.defaults;
  return { ...initialValues, ...extractedDefaults };
}

function sanitizeValues(candidate: object, defaults: SimulatorValues): SimulatorValues {
  const source = candidate as Readonly<Record<string, unknown>>;
  const next = { ...defaults } as SimulatorValues;
  for (const [key, bounds] of Object.entries(numericBounds) as Array<[keyof SimulatorValues, readonly [number, number]]>) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      (next as unknown as Record<string, unknown>)[key] = Math.min(bounds[1], Math.max(bounds[0], value));
    }
  }
  for (const [key, allowed] of Object.entries(choiceValues) as Array<[keyof SimulatorValues, readonly string[]]>) {
    const value = source[key];
    if (typeof value === "string" && allowed.includes(value)) {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

function storageKey(brand: string, model: string): string {
  return `${storageKeyPrefix}${encodeURIComponent(brand)}:${encodeURIComponent(model)}`;
}

function loadSavedValues(brand: string, model: string, defaults: SimulatorValues): SimulatorValues {
  try {
    const serialized = window.localStorage.getItem(storageKey(brand, model));
    if (!serialized) return defaults;

    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("brand" in parsed) ||
      !("model" in parsed) ||
      !("values" in parsed) ||
      parsed.brand !== brand ||
      parsed.model !== model ||
      typeof parsed.values !== "object" ||
      parsed.values === null
    ) {
      return defaults;
    }

    return sanitizeValues(parsed.values, defaults);
  } catch {
    return defaults;
  }
}

export default function SimulatorShell() {
  const [screen, setScreen] = useState<"selector" | "editor">("selector");
  const [selection, setSelection] = useState({ brand: "ninebot", model: "Kz110" });
  const [values, setValues] = useState(initialValues);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const model = useMemo(() => {
    const brand = catalog.find((item) => item.brand === selection.brand) ?? catalog[0];
    return brand.models.find((item) => item.name === selection.model) ?? brand.models[0];
  }, [selection]);
  const defaults = useMemo(
    () => modelDefaults(selection.brand, selection.model),
    [selection.brand, selection.model],
  );

  if (screen === "selector") {
    return (
      <VehicleSelector
        onLoad={(brand, selectedModel) => {
          const defaults = modelDefaults(brand, selectedModel);
          setSelection({ brand, model: selectedModel });
          setValues(loadSavedValues(brand, selectedModel, defaults));
          setScreen("editor");
        }}
      />
    );
  }

  return (
    <main className="motomate-editor-shell">
      <ControlSidebar
        defaultValues={defaults}
        onBack={() => setScreen("selector")}
        onChange={setValues}
        onSave={() => {
          const savedSimulator: SavedSimulator = {
            brand: selection.brand,
            model: selection.model,
            values,
          };
          try {
            window.localStorage.setItem(
              storageKey(selection.brand, selection.model),
              JSON.stringify(savedSimulator),
            );
            setSaveNotice("已保存到本机");
          } catch {
            setSaveNotice("保存失败，请检查浏览器存储权限");
          }
          window.setTimeout(() => setSaveNotice(null), 1800);
        }}
        values={values}
      />
      <MotorCanvas
        brand={selection.brand}
        defaultValues={defaults}
        imageSrc={model.image || photoAssets[`${selection.brand}/${selection.model}`] || undefined}
        model={model}
        values={values}
      />
      {saveNotice ? <div className="motomate-save-toast">{saveNotice}</div> : null}
    </main>
  );
}
