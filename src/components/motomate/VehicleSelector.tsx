"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import lineAssetData from "@/data/motomate-line-assets.json";
import thumbnailAssetData from "@/data/motomate-thumbnail-assets.json";
import { publicPath } from "@/lib/publicPath";
import InfoToolbar from "./InfoToolbar";
import { encodeLocalAssetPath } from "./vehicleSelectorDomain";

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
  catalog: readonly VehicleBrand[];
  onLoad: (brand: string, model: string) => void;
}>;

const lineAssets: Readonly<Record<string, string>> = lineAssetData;
const thumbnailAssets: Readonly<Record<string, string>> = thumbnailAssetData;

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

function VehicleArtwork({
  brand,
  decorative = false,
  model,
  width,
}: Readonly<{ brand: string; decorative?: boolean; model: VehicleModel; width: number }>) {
  const modelKey = `${brand}/${model.name}`;
  const candidates = useMemo(() => (
    [...new Set([model.image, thumbnailAssets[modelKey], lineAssets[modelKey]].filter(Boolean))]
  ), [model.image, modelKey]);
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set());
  const imagePath = candidates.find((candidate) => !failedSources.has(candidate));

  if (imagePath) {
    return (
      <Image
        alt={decorative ? "" : model.name}
        fill
        onError={() => setFailedSources((current) => new Set([...current, imagePath]))}
        sizes={`${width}px`}
        src={publicPath(encodeLocalAssetPath(imagePath))}
        unoptimized
      />
    );
  }
  return <span className="motomate-model-placeholder">NO IMAGE</span>;
}

export default function VehicleSelector({ catalog, onLoad }: VehicleSelectorProps) {
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [selection, setSelection] = useState<Readonly<{
    brand: string;
    model: VehicleModel;
  }> | null>(null);

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

  return (
    <main className="motomate-selector">
      <InfoToolbar />
      <nav className="motomate-brand-bar" aria-label="车辆品牌">
        {catalog.map((brand) => (
          <button
            className={`motomate-brand-tab${brand.brand === activeBrand ? " is-active" : ""}`}
            aria-pressed={brand.brand === activeBrand}
            key={brand.brand}
            onClick={() => {
              setActiveBrand(brand.brand);
              setSelection(null);
            }}
            type="button"
          >
            {brandIcons[brand.brand] ? (
              <Image alt="" height={36} src={publicPath(brandIcons[brand.brand])} unoptimized width={36} />
            ) : (
              <span className="motomate-brand-icon-fallback" aria-hidden="true">
                {brand.brand.charAt(0)}
              </span>
            )}
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
                  const selected =
                    selection?.brand === currentBrand.brand && selection.model.index === model.index;
                  return (
                    <button
                      className={`motomate-model-card${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      key={`${category}-${model.index}-${model.name}`}
                      onClick={() => {
                        setSelection({ brand: currentBrand.brand, model });
                      }}
                      type="button"
                    >
                      <span className="motomate-model-image-wrap">
                        <VehicleArtwork
                          brand={currentBrand.brand}
                          decorative
                          key={`${currentBrand.brand}/${model.name}`}
                          model={model}
                          width={130}
                        />
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

      <div className={`motomate-selection-dock${selection ? " is-ready" : ""}`}>
        {selection ? (
          <aside className="motomate-promoted-card" aria-label={`已选车型 ${selection.model.name}`}>
            <span className="motomate-promoted-image-wrap">
              <VehicleArtwork
                brand={selection.brand}
                key={`${selection.brand}/${selection.model.name}`}
                model={selection.model}
                width={120}
              />
            </span>
            <span>{selection.model.name}</span>
          </aside>
        ) : null}

        <button
          className={`motomate-start-button${selection ? " is-ready" : ""}`}
          disabled={!selection}
          onClick={() => selection && onLoad(selection.brand, selection.model.name)}
          type="button"
        >
          <span className="motomate-start-icons">◉ <b>VS</b></span>
          <span>{selection ? `载入 ${selection.model.name}` : "点击品牌，选择车型"}</span>
        </button>
      </div>

      <div className="motomate-loading-rule" aria-hidden="true" />
    </main>
  );
}
