"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ACCESSORY_CATEGORIES,
  MOTOMATE_ACCESSORIES,
  type AccessoryCategoryId,
} from "@/data/motomate-accessories";

const STORAGE_KEY = "mod-emotor-accessories-v1";

type AccessorySelections = Readonly<Partial<Record<AccessoryCategoryId, string>>>;

type AccessoryLibraryProps = Readonly<{
  onClose: () => void;
}>;

function loadSelections(): AccessorySelections {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const stored = parsed as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      ACCESSORY_CATEGORIES.flatMap(({ id }) => {
        const accessoryId = stored[id];
        const valid = typeof accessoryId === "string"
          && MOTOMATE_ACCESSORIES.some((item) => item.id === accessoryId && item.type === id);
        return valid ? [[id, accessoryId]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export default function AccessoryLibrary({ onClose }: AccessoryLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<AccessoryCategoryId>("frontSuspension");
  const [query, setQuery] = useState("");
  const [selections, setSelections] = useState<AccessorySelections>(loadSelections);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  const activeDefinition = ACCESSORY_CATEGORIES.find(({ id }) => id === activeCategory)
    ?? ACCESSORY_CATEGORIES[0];
  const filteredAccessories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return MOTOMATE_ACCESSORIES.filter((item) => {
      if (item.type !== activeCategory) return false;
      if (!normalizedQuery) return true;
      return `${item.name} ${item.brand} ${item.concise}`.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [activeCategory, query]);

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
    setSelections((current) => ({
      ...current,
      [activeCategory]: current[activeCategory] === accessoryId ? undefined : accessoryId,
    }));
  };

  return (
    <section
      className="motomate-accessory-workspace"
    >
      <header className="motomate-accessory-header">
        <h2 id="motomate-accessory-title">配件列表</h2>
        <div className="motomate-accessory-header-actions">
          <button type="button" aria-label="保存配件设置" onClick={save}>保存</button>
          <button type="button" aria-label="返回模拟器" onClick={onClose}>返回</button>
        </div>
      </header>

      <nav className="motomate-accessory-category-nav" aria-label="配件分类">
        {ACCESSORY_CATEGORIES.map((category) => (
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
          <span>搜索名称、品牌或规格</span>
          <input
            type="search"
            value={query}
            placeholder="例如 Brembo、3000w、340孔距"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>

        <div className="motomate-accessory-grid" aria-live="polite">
          {filteredAccessories.map((accessory) => {
            const selected = selections[activeCategory] === accessory.id;
            return (
              <button
                className={`motomate-accessory-card${selected ? " is-selected" : ""}`}
                type="button"
                aria-pressed={selected}
                aria-label={`${selected ? "取消" : "启用"}${accessory.brand} ${accessory.name}，${accessory.concise}`}
                key={accessory.id}
                onClick={() => toggleAccessory(accessory.id)}
              >
                <span className="motomate-accessory-placeholder" aria-hidden="true">
                  {activeDefinition.placeholder}
                </span>
                <span className="motomate-accessory-card-copy">
                  <strong>{accessory.name}</strong>
                  <span>{accessory.brand}</span>
                  <small>{accessory.concise}</small>
                </span>
                <span className="motomate-accessory-switch" aria-hidden="true">
                  <span />
                </span>
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
