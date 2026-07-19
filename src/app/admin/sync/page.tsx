"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAssetSummary,
  getMeta,
  reindexAssets,
  syncFull,
  syncIncremental,
  syncSelective,
  type AssetSummary,
  type MetaResponse,
  type SelectiveBody,
  type SyncResult,
} from "@/lib/adminApi";
import {
  ACCENT,
  AccentButton,
  DashedCard,
  GhostButton,
  Panel,
  SectionHeading,
} from "@/components/admin/ui";

type SyncMode = "full" | "incremental" | "selective" | null;
type SyncState =
  | { mode: SyncMode; status: "idle" }
  | { mode: SyncMode; status: "running" }
  | { mode: SyncMode; status: "ok"; result: SyncResult }
  | { mode: SyncMode; status: "error"; message: string };

export default function SyncPage() {
  const [syncState, setSyncState] = useState<SyncState>({ mode: null, status: "idle" });
  const [showSelective, setShowSelective] = useState(false);

  const runSync = async (mode: "full" | "incremental") => {
    setSyncState({ mode, status: "running" });
    try {
      const result = mode === "full" ? await syncFull() : await syncIncremental();
      setSyncState({ mode, status: "ok", result });
    } catch (e) {
      setSyncState({
        mode,
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <>
      <Panel>
        <SectionHeading title="原站同步" hint="完全 / 增量 / 选择数据 三种复刻" />
        <p className="mt-4 text-sm text-slate-500">
          上游为 motomate.cn。完全同步拉全量并 upsert；增量仍拉全量但仅写入 raw_data 变化或新增的行；选择同步按品牌/类型/product_id 精确拉取。
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <ModeCard
            title="完全复刻"
            desc="拉取全部电机 / 配件 / 附加项并 upsert，含图片下载。耗时较长。"
            cta="开始完全同步"
            disabled={syncState.status === "running"}
            onClick={() => runSync("full")}
          />
          <ModeCard
            title="增量复刻"
            desc="上游无 since 过滤，仍拉全量，但只写入变化的行，省 DB 写入与图片下载。"
            cta="开始增量同步"
            disabled={syncState.status === "running"}
            onClick={() => runSync("incremental")}
          />
          <ModeCard
            title="选择数据复刻"
            desc="按品牌 / 类型 / product_id 选择要复刻的数据，展开下方表单。"
            cta={showSelective ? "收起表单" : "展开选择表单"}
            disabled={syncState.status === "running"}
            onClick={() => setShowSelective((v) => !v)}
          />
        </div>
        <SyncStatus state={syncState} />
      </Panel>

      {showSelective && (
        <SelectivePanel
          onDone={async (body) => {
            setSyncState({ mode: "selective", status: "running" });
            try {
              const result = await syncSelective(body);
              setSyncState({ mode: "selective", status: "ok", result });
            } catch (e) {
              setSyncState({
                mode: "selective",
                status: "error",
                message: e instanceof Error ? e.message : String(e),
              });
            }
          }}
        />
      )}

      <AssetIndexPanel />
    </>
  );
}

function ModeCard({
  title,
  desc,
  cta,
  disabled,
  onClick,
}: {
  title: string;
  desc: string;
  cta: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <DashedCard className="flex flex-col">
      <div className="mb-1 font-medium" style={{ color: ACCENT }}>
        {title}
      </div>
      <p className="mb-3 flex-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      <AccentButton onClick={onClick} disabled={disabled} className="self-start">
        {cta}
      </AccentButton>
    </DashedCard>
  );
}

function SyncStatus({ state }: { state: SyncState }) {
  if (state.status === "idle" && state.mode === null) return null;
  const label =
    state.status === "running"
      ? `正在同步（${state.mode}）…`
      : state.status === "ok"
        ? `同步完成（${state.mode}）`
        : `同步失败（${state.mode}）`;
  const color =
    state.status === "ok"
      ? "text-emerald-600"
      : state.status === "error"
        ? "text-red-600"
        : "text-slate-600";
  return (
    <div className="mt-5 rounded-md bg-[var(--motomate-soft)] px-4 py-3 text-sm">
      <div className={`font-medium ${color}`}>{label}</div>
      {state.status === "ok" && state.result && (
        <div className="mt-1 text-xs text-slate-500">
          motors: {state.result.motors ?? 0} · parts: {state.result.parts ?? 0} ·
          additems: {state.result.additems ?? 0} · images: {state.result.images ?? 0}
          {typeof state.result.skipped === "number" && <> · skipped: {state.result.skipped}</>}
        </div>
      )}
      {state.status === "error" && (
        <div className="mt-1 break-all text-xs text-red-500">{state.message}</div>
      )}
    </div>
  );
}

function SelectivePanel({ onDone }: { onDone: (body: SelectiveBody) => Promise<void> }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [motors, setMotors] = useState<{ brands: Set<string>; types: Set<string> }>({
    brands: new Set(),
    types: new Set(),
  });
  const [parts, setParts] = useState<{
    brands: Set<string>;
    types: Set<string>;
    product_ids: string;
  }>({ brands: new Set(), types: new Set(), product_ids: "" });
  const [additems, setAdditems] = useState<{
    brands: Set<string>;
    types: Set<string>;
    product_ids: string;
  }>({ brands: new Set(), types: new Set(), product_ids: "" });
  const [downloadImages, setDownloadImages] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  const toggle = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const submit = async () => {
    const body: SelectiveBody = {};
    if (motors.brands.size || motors.types.size) {
      body.motors = { brands: [...motors.brands], types: [...motors.types] };
    }
    const partIds = parts.product_ids.split(/[\s,，;]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.brands.size || parts.types.size || partIds.length) {
      body.parts = {
        brands: [...parts.brands],
        types: [...parts.types],
        product_ids: partIds,
      };
    }
    const additemIds = additems.product_ids.split(/[\s,，;]+/).map((s) => s.trim()).filter(Boolean);
    if (additems.brands.size || additems.types.size || additemIds.length) {
      body.additems = {
        brands: [...additems.brands],
        types: [...additems.types],
        product_ids: additemIds,
      };
    }
    if (downloadImages) body.download_images = true;
    if (!Object.keys(body).length) {
      window.alert("请至少选择一项要复刻的数据");
      return;
    }
    setBusy(true);
    try {
      await onDone(body);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <SectionHeading title="选择数据复刻" hint="品牌 / 类型 / product_id" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Block title="电机 (motors)">
          <CheckboxList
            label="品牌"
            options={meta?.brands.motors ?? []}
            selected={motors.brands}
            onToggle={(v) => toggle(motors.brands, v, (s) => setMotors({ ...motors, brands: s }))}
          />
          <CheckboxList
            label="类型"
            options={meta?.types.motors ?? []}
            selected={motors.types}
            onToggle={(v) => toggle(motors.types, v, (s) => setMotors({ ...motors, types: s }))}
          />
        </Block>
        <Block title="配件 (parts)">
          <CheckboxList
            label="品牌"
            options={meta?.brands.parts ?? []}
            selected={parts.brands}
            onToggle={(v) => toggle(parts.brands, v, (s) => setParts({ ...parts, brands: s }))}
          />
          <CheckboxList
            label="类型"
            options={meta?.types.parts ?? []}
            selected={parts.types}
            onToggle={(v) => toggle(parts.types, v, (s) => setParts({ ...parts, types: s }))}
          />
          <label className="block text-xs text-slate-500">
            product_id（逗号/空格分隔，逐个拉取）
            <textarea
              value={parts.product_ids}
              onChange={(e) => setParts({ ...parts, product_ids: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="如: PID001, PID002"
            />
          </label>
        </Block>
        <Block title="附加项 (additems)">
          <CheckboxList
            label="品牌"
            options={meta?.brands.additems ?? []}
            selected={additems.brands}
            onToggle={(v) => toggle(additems.brands, v, (s) => setAdditems({ ...additems, brands: s }))}
          />
          <CheckboxList
            label="类型"
            options={meta?.types.additems ?? []}
            selected={additems.types}
            onToggle={(v) => toggle(additems.types, v, (s) => setAdditems({ ...additems, types: s }))}
          />
          <label className="block text-xs text-slate-500">
            product_id（逗号/空格分隔，逐个拉取）
            <textarea
              value={additems.product_ids}
              onChange={(e) => setAdditems({ ...additems, product_ids: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="如: AID001, AID002"
            />
          </label>
        </Block>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={downloadImages}
            onChange={(e) => setDownloadImages(e.target.checked)}
          />
          同步缺失图片
        </label>
        <AccentButton onClick={submit} disabled={busy}>
          {busy ? "同步中…" : "开始选择性同步"}
        </AccentButton>
      </div>
    </Panel>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[var(--motomate-soft)] p-4">
      <div className="mb-3 text-sm font-medium" style={{ color: ACCENT }}>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CheckboxList({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  if (!options.length) {
    return <div className="text-xs text-slate-400">{label}：（暂无候选，先做一次完全同步）</div>;
  }
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      <div className="max-h-32 overflow-auto rounded border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-1 text-xs text-slate-700">
              <input type="checkbox" checked={selected.has(opt)} onChange={() => onToggle(opt)} />
              {opt}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Asset index panel — shows counts per kind + reindex button. The assets
 * table is what makes image paths genuinely resolvable in the DB (replacing
 * dead @/assets/... aliases with real /motomate/... hashed paths). */
function AssetIndexPanel() {
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await getAssetSummary());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onReindex = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await reindexAssets();
      setMsg(`完成：${r.brand_name_pairs} 组 brand/name，共 upsert ${r.upserted} 条`);
      refresh();
    } catch (e) {
      setMsg(`失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <SectionHeading title="图片资源索引" hint="assets 表是 DB 中可解析的图片路径真源" />
      <p className="mt-3 text-sm text-slate-500">
        从 <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/data/motomate-*.json</code> 读取前端 asset manifest，写入
        DB <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">assets</code> 表。导入或同步时自动把 <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">@/assets/...</code> 死路径归一化为真实 <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/motomate/...</code> 哈希路径。
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="总计" value={summary?.total ?? "—"} />
        <Stat label="car" value={summary?.by_kind.car ?? 0} />
        <Stat label="thumbnail" value={summary?.by_kind.thumbnail ?? 0} />
        <Stat label="line" value={summary?.by_kind.line ?? 0} />
        <Stat label="photo" value={summary?.by_kind.photo ?? 0} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <AccentButton onClick={onReindex} disabled={busy}>
          {busy ? "索引中…" : "重新索引"}
        </AccentButton>
        <GhostButton onClick={refresh}>刷新</GhostButton>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[var(--motomate-soft)] px-3 py-2">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="text-lg font-semibold" style={{ color: ACCENT }}>
        {value}
      </div>
    </div>
  );
}
