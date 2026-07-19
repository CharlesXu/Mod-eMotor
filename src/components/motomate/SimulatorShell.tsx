"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCatalog,
  recviceMotorInfo,
  fetchMechanicalProfiles,
  fetchPhotoAssets,
  fetchThumbnailAssets,
  fetchLineAssets,
  fetchGeometryProfiles,
  type CatalogBrand,
} from "@/lib/api";
import { ControlSidebar, type SimulatorValues } from "./ControlSidebar";
import InfoToolbar from "./InfoToolbar";
import MotorCanvas from "./MotorCanvas";
import { clampNumericValues } from "./simulatorDomain";
import VehicleSelector, { type VehicleModel } from "./VehicleSelector";

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

const choiceValues: Readonly<Partial<Record<keyof SimulatorValues, readonly string[]>>> = {
  frontWheelPosition: ["前位", "中位", "后位"], frontForkStyle: ["正常", "倒置"],
  frontForkAirbag: ["无", "P1", "P2"], frontCaliperPosition: ["前置", "后置"],
  frontFender: ["无", "短", "长"], rearCaliperPosition: ["前置", "后置"],
  rearFender: ["无", "短", "长"], rearShockAirbag: ["无", "P1", "P2", "P3"],
  accessory: ["无", "尾箱", "风挡"],
  paint: ["原厂", "亮黑", "哑光"], posture: ["标准", "运动", "舒适"],
};

type MechanicalProfiles = Readonly<Record<string, Readonly<{
  defaults: Partial<SimulatorValues>;
}>>>;

function modelDefaults(brand: string, modelName: string, profiles: MechanicalProfiles): SimulatorValues {
  const extractedDefaults = profiles[`${brand}/${modelName}`]?.defaults;
  const defaults = { ...initialValues, ...extractedDefaults };
  return clampNumericValues(defaults, defaults);
}

function sanitizeValues(candidate: object, defaults: SimulatorValues): SimulatorValues {
  const source = candidate as Readonly<Record<string, unknown>>;
  const next = clampNumericValues(source, defaults);
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
  const [controlsOpen, setControlsOpen] = useState(false);

  // All data loaded from backend API
  const [catalog, setCatalog] = useState<readonly Readonly<{
    brand: string;
    models: readonly VehicleModel[];
  }>[]>([]);
  const [mechanicalProfiles, setMechanicalProfiles] = useState<MechanicalProfiles>({});
  const [photoAssets, setPhotoAssets] = useState<Readonly<Record<string, string>>>({});
  const [thumbnailAssets, setThumbnailAssets] = useState<Readonly<Record<string, string>>>({});
  const [lineAssets, setLineAssets] = useState<Readonly<Record<string, string>>>({});
  const [geometryProfiles, setGeometryProfiles] = useState<Readonly<Record<string, unknown>>>({});
  const [dataReady, setDataReady] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Load catalog from DB-backed API
    getCatalog()
      .then((res) => {
        if (!cancelled && res.stat === "success" && res.data.length > 0) {
          setCatalog(res.data);
          setApiConnected(true);
        }
      })
      .catch(() => {});

    // Load static data files from backend API
    Promise.all([
      fetchMechanicalProfiles(),
      fetchPhotoAssets(),
      fetchThumbnailAssets(),
      fetchLineAssets(),
      fetchGeometryProfiles(),
    ])
      .then(([mech, photo, thumb, line, geo]) => {
        if (!cancelled) {
          setMechanicalProfiles(mech as MechanicalProfiles);
          setPhotoAssets(photo);
          setThumbnailAssets(thumb);
          setLineAssets(line);
          setGeometryProfiles(geo);
          setDataReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setDataReady(true); // proceed with empty data
      });

    return () => { cancelled = true; };
  }, []);

  const saveConfigToApi = useCallback(async (brand: string, model: string, vals: SimulatorValues) => {
    if (!apiConnected) return;
    try {
      await recviceMotorInfo({
        brand,
        motor: model,
        ...vals,
      });
    } catch {
      // silently fail, localStorage is still used
    }
  }, [apiConnected]);

  const model = useMemo(() => {
    if (!catalog.length) return null;
    const brand = catalog.find((item) => item.brand === selection.brand) ?? catalog[0];
    return brand.models.find((item) => item.name === selection.model) ?? brand.models[0];
  }, [selection, catalog]);
  const defaults = useMemo(
    () => modelDefaults(selection.brand, selection.model, mechanicalProfiles),
    [selection.brand, selection.model, mechanicalProfiles],
  );

  if (!dataReady) {
    return (
      <main className="motomate-selector" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <p style={{ color: "rgba(65,91,117,0.5)", fontSize: 14 }}>加载数据中…</p>
      </main>
    );
  }

  if (screen === "selector") {
    return (
      <VehicleSelector
        catalog={catalog}
        thumbnailAssets={thumbnailAssets}
        lineAssets={lineAssets}
        onLoad={(brand, selectedModel) => {
          const defaults = modelDefaults(brand, selectedModel, mechanicalProfiles);
          setSelection({ brand, model: selectedModel });
          setValues(loadSavedValues(brand, selectedModel, defaults));
          setScreen("editor");
        }}
      />
    );
  }

  return (
    <main className="motomate-editor-shell">
      <InfoToolbar />
      <div className={`motomate-controls-panel${controlsOpen ? " is-open" : " is-collapsed"}`}>
        <button
          className="motomate-mobile-controls-toggle"
          type="button"
          aria-controls="motomate-mobile-controls"
          aria-expanded={controlsOpen}
          onClick={() => setControlsOpen((open) => !open)}
        >
          {controlsOpen ? "收起参数" : "展开参数调整"}
          <span aria-hidden="true">{controlsOpen ? "⌃" : "⌄"}</span>
        </button>
        <div id="motomate-mobile-controls" className="motomate-controls-content">
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
              saveConfigToApi(selection.brand, selection.model, values);
              window.setTimeout(() => setSaveNotice(null), 1800);
            }}
            values={values}
          />
        </div>
      </div>
      <MotorCanvas
        brand={selection.brand}
        defaultValues={defaults}
        geometryProfiles={geometryProfiles}
        imageSrc={model?.image || photoAssets[`${selection.brand}/${selection.model}`] || undefined}
        lineAssets={lineAssets}
        mechanicalProfiles={mechanicalProfiles}
        model={model}
        values={values}
      />
      {saveNotice ? <div className="motomate-save-toast">{saveNotice}</div> : null}
    </main>
  );
}
