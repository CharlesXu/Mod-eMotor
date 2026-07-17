"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ACCESSORY_CATEGORIES,
  ACCESSORY_GALLERIES,
  MOTOMATE_ACCESSORIES,
  type AccessoryCategoryId,
  type AccessoryGalleryId,
  type AccessoryRecord,
} from "@/data/motomate-accessories";
import { publicPath } from "@/lib/publicPath";

const STORAGE_KEY = "mod-emotor-accessories-v2";

type AccessorySelections = Readonly<Record<string, string>>;

type AccessoryLibraryProps = Readonly<{
  onClose: () => void;
}>;

function selectionKey(gallery: AccessoryGalleryId, category: AccessoryCategoryId): string {
  return `${gallery}:${category}`;
}

function localImagePath(source: string): string {
  const encoded = source.split("/").map((segment) => {
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch {
      return encodeURIComponent(segment);
    }
  }).join("/");
  return publicPath(encoded);
}

function loadSelections(): AccessorySelections {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(Object.entries(parsed).flatMap(([key, value]) => {
      if (typeof value !== "string") return [];
      const item = MOTOMATE_ACCESSORIES.find(({ id }) => id === value);
      return item && selectionKey(item.kind, item.type) === key ? [[key, value]] : [];
    }));
  } catch {
    return {};
  }
}

function AccessoryImage({ item, source, slot }: Readonly<{
  item: AccessoryRecord;
  source: string;
  slot: number;
}>) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="motomate-accessory-image-error" role="img" aria-label="图片加载失败">图片加载失败</span>;
  }

  return (
    <Image
      alt={`${item.brand} ${item.name}${slot > 1 ? ` 图片 ${slot}` : ""}`}
      height={132}
      loading="lazy"
      onError={() => setFailed(true)}
      src={localImagePath(source)}
      unoptimized
      width={220}
    />
  );
}

export default function AccessoryLibrary({ onClose }: AccessoryLibraryProps) {
  const [activeGallery, setActiveGallery] = useState<AccessoryGalleryId>("photo");
  const [activeCategory, setActiveCategory] = useState<AccessoryCategoryId>("frontSuspension");
  const [query, setQuery] = useState("");
  const [selections, setSelections] = useState<AccessorySelections>(loadSelections);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const availableCategories = useMemo(() => ACCESSORY_CATEGORIES.filter((category) => (
    MOTOMATE_ACCESSORIES.some((item) => item.kind === activeGallery && item.type === category.id)
  )), [activeGallery]);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  const filteredAccessories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return MOTOMATE_ACCESSORIES.filter((item) => {
      if (item.kind !== activeGallery || item.type !== activeCategory) return false;
      if (!normalizedQuery) return true;
      return [item.name, item.brand, item.size, item.concise, item.describe]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeCategory, activeGallery, query]);

  const showToast = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };

  const save = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
      showToast("配件设置已保存");
    } catch {
      showToast("保存失败，请检查浏览器存储权限");
    }
  };

  const toggleAccessory = (accessoryId: string) => {
    const key = selectionKey(activeGallery, activeCategory);
    setSelections((current) => {
      if (current[key] === accessoryId) {
        return Object.fromEntries(Object.entries(current).filter(([storedKey]) => storedKey !== key));
      }
      return { ...current, [key]: accessoryId };
    });
  };

  const switchGallery = (gallery: AccessoryGalleryId) => {
    setActiveGallery(gallery);
    const categories = ACCESSORY_CATEGORIES.filter((category) => (
      MOTOMATE_ACCESSORIES.some((item) => item.kind === gallery && item.type === category.id)
    ));
    const fallbackCategory = categories[0]?.id;
    if (fallbackCategory && !categories.some(({ id }) => id === activeCategory)) {
      setActiveCategory(fallbackCategory);
    }
  };

  const currentSelectionKey = selectionKey(activeGallery, activeCategory);

  return (
    <section className="motomate-accessory-workspace">
      <header className="motomate-accessory-header">
        <h2 id="motomate-accessory-title">配件列表</h2>
        <nav className="motomate-accessory-gallery-nav" aria-label="图库">
          {ACCESSORY_GALLERIES.map((gallery) => (
            <button
              className={gallery.id === activeGallery ? "is-active" : undefined}
              type="button"
              aria-pressed={gallery.id === activeGallery}
              key={gallery.id}
              onClick={() => switchGallery(gallery.id)}
            >
              {gallery.label}（{gallery.count}）
            </button>
          ))}
        </nav>
        <div className="motomate-accessory-header-actions">
          <button type="button" aria-label="保存配件设置" onClick={save}>保存</button>
          <button type="button" aria-label="返回模拟器" onClick={onClose}>返回</button>
        </div>
      </header>

      <nav className="motomate-accessory-category-nav" aria-label="配件分类">
        {availableCategories.map((category) => (
          <button
            className={category.id === activeCategory ? "is-active" : undefined}
            type="button"
            aria-pressed={category.id === activeCategory}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </nav>

      <div className="motomate-accessory-content">
        <label className="motomate-accessory-search">
          <span>搜索名称、品牌、规格或描述</span>
          <input
            type="search"
            value={query}
            placeholder="例如 Brembo、3000w、340孔距"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>

        <div className="motomate-accessory-grid" aria-live="polite">
          {filteredAccessories.map((accessory) => {
            const selected = selections[currentSelectionKey] === accessory.id;
            const imageSources = accessory.imageSrc1 === accessory.imageSrc2
              ? [accessory.imageSrc1]
              : [accessory.imageSrc1, accessory.imageSrc2];
            return (
              <button
                className={`motomate-accessory-card${selected ? " is-selected" : ""}`}
                type="button"
                aria-pressed={selected}
                aria-label={`${selected ? "取消" : "选择"}${accessory.brand} ${accessory.name}，${accessory.concise}`}
                key={accessory.id}
                onClick={() => toggleAccessory(accessory.id)}
              >
                <span className={`motomate-accessory-images${imageSources.length > 1 ? " has-two" : ""}`}>
                  {imageSources.map((source, index) => (
                    <AccessoryImage item={accessory} source={source} slot={index + 1} key={`${accessory.id}-${index}`} />
                  ))}
                </span>
                <span className="motomate-accessory-card-copy">
                  <strong>{accessory.name}</strong>
                  <span>{accessory.brand}</span>
                  <small>{accessory.concise || accessory.size || "暂无规格"}</small>
                </span>
                <span className="motomate-accessory-switch" aria-hidden="true"><span /></span>
              </button>
            );
          })}
        </div>

        {filteredAccessories.length === 0 ? (
          <p className="motomate-accessory-empty">没有匹配的配件</p>
        ) : null}
      </div>

      {toast ? <div className="motomate-accessory-toast" role="status">{toast}</div> : null}
    </section>
  );
}
