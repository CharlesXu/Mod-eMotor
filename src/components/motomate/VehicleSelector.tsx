"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import catalogData from "@/data/motomate-catalog.json";
import lineAssetData from "@/data/motomate-line-assets.json";
import photoAssetData from "@/data/motomate-photo-assets.json";

export type VehicleModel = Readonly<{
  index: number;
  name: string;
  image: string;
  category: string;
}>;

type VehicleBrand = Readonly<{
  brand: string;
  models: readonly VehicleModel[];
}>;

type VehicleSelectorProps = Readonly<{
  onLoad: (brand: string, model: string) => void;
}>;

const catalog: readonly VehicleBrand[] = catalogData;
const lineAssets: Readonly<Record<string, string>> = lineAssetData;
const photoAssets: Readonly<Record<string, string>> = photoAssetData;

const brandIcons: Readonly<Record<string, string>> = {
  ZEEKU: "/motomate/ZEEKU.82855666.png",
  ZEEHO: "/motomate/ZEEHO.f3a7f4c5.png",
  ninebot: "/motomate/ninebot.b23e5755.png",
  NIU: "/motomate/NIU.4614506d.png",
  Honda: "/motomate/Honda.e1c90870.png",
  YADEA: "/motomate/YADEA.742d92e4.png",
  TAILG: "/motomate/TAILG.e6342089.png",
  SYUAN: "/motomate/SYUAN.2922ebea.png",
  skymotor: "/motomate/SKYMOTOR.5b6ddde7.png",
  OTHER: "/motomate/OTHER.560abe8f.png",
};

const defaultBrand = catalog.find(({ brand }) => brand === "ninebot") ?? catalog[0];
const defaultModel =
  defaultBrand.models.find(({ name }) => name === "Kz110") ?? defaultBrand.models[0];

function localImagePath(brand: string, model: VehicleModel): string | null {
  const modelKey = `${brand}/${model.name}`;
  return model.image || photoAssets[modelKey] || lineAssets[modelKey] || null;
}

export default function VehicleSelector({ onLoad }: VehicleSelectorProps) {
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [selection, setSelection] = useState({
    brand: defaultBrand.brand,
    model: defaultModel,
  });
  const [ready, setReady] = useState(false);

  const currentBrand = catalog.find(({ brand }) => brand === activeBrand);
  const categoryGroups = useMemo(() => {
    if (!currentBrand) return [];
    return Object.entries(
      currentBrand.models.reduce<Record<string, VehicleModel[]>>(
        (groups, model) => ({
          ...groups,
          [model.category]: [...(groups[model.category] ?? []), model],
        }),
        {},
      ),
    );
  }, [currentBrand]);

  const promotedImage = localImagePath(selection.brand, selection.model);

  return (
    <main className="motomate-selector">
      <nav className="motomate-brand-bar" aria-label="车辆品牌">
        {catalog.map((brand) => (
          <button
            className={`motomate-brand-tab${brand.brand === activeBrand ? " is-active" : ""}`}
            key={brand.brand}
            onClick={() => {
              setActiveBrand(brand.brand);
              setReady(false);
            }}
            type="button"
          >
            <Image alt="" height={36} src={brandIcons[brand.brand]} unoptimized width={36} />
            <span>{brand.brand}</span>
          </button>
        ))}
      </nav>

      <section className="motomate-start-copy">
        <h1>选择车辆，开始<strong>模拟</strong></h1>
        <p><strong>Mod-eMotor</strong> · 电改模拟工具</p>
      </section>

      {currentBrand ? (
        <section className="motomate-model-catalog" aria-label={`${currentBrand.brand} 车型`}>
          {categoryGroups.map(([category, models]) => (
            <div className="motomate-model-group" key={category}>
              <h2>{category}</h2>
              <div className="motomate-model-list">
                {models.map((model) => {
                  const imagePath = localImagePath(currentBrand.brand, model);
                  const selected =
                    selection.brand === currentBrand.brand && selection.model.index === model.index;
                  return (
                    <button
                      className={`motomate-model-card${selected && ready ? " is-selected" : ""}`}
                      key={`${category}-${model.index}-${model.name}`}
                      onClick={() => {
                        setSelection({ brand: currentBrand.brand, model });
                        setReady(true);
                      }}
                      type="button"
                    >
                      <span className="motomate-model-image-wrap">
                        {imagePath ? (
                          <Image alt={model.name} fill sizes="140px" src={imagePath} unoptimized />
                        ) : (
                          <span className="motomate-model-placeholder">NO IMAGE</span>
                        )}
                      </span>
                      <span>{model.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <aside className="motomate-promoted-card">
        <span className="motomate-promoted-image-wrap">
          {promotedImage ? (
            <Image alt={selection.model.name} fill sizes="120px" src={promotedImage} unoptimized />
          ) : null}
        </span>
        <span>{selection.model.name}</span>
      </aside>

      <button
        className={`motomate-start-button${ready ? " is-ready" : ""}`}
        onClick={() => ready && onLoad(selection.brand, selection.model.name)}
        type="button"
      >
        <span className="motomate-start-icons">◉ <b>VS</b></span>
        <span>{ready ? `载入 ${selection.model.name}` : "点击品牌，选择车型"}</span>
      </button>

      <div className="motomate-loading-rule" aria-hidden="true" />
    </main>
  );
}
