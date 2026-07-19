/**
 * Admin management API client — CRUD + sync.
 *
 * JSON style (unlike the multipart protocol-compat endpoints in api.ts).
 * Backend runs on the same API_BASE; CORS is open, so plain fetch works
 * cross-origin in dev. /admin/* is also proxied by next.config.ts rewrites
 * for same-origin in production.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3807";

export type ResourceSlug = "vehicles" | "motors" | "parts" | "additems";

/** A row as returned by the admin CRUD endpoints (id + editable fields). */
export type Row = { id: number; [k: string]: unknown };

export interface ListResponse<T> {
  total: number;
  page: number;
  page_size: number;
  data: T[];
}

export interface ApiResult<T> {
  stat: "success" | "fail" | "partial";
  data?: T;
  reason?: string;
  result?: T;
}

// ─── Field metadata (mirrors backend EDITABLE_FIELDS in crud.py) ──────────
// Drives the dynamic table columns + edit form per resource.

export interface FieldDef {
  k: string;
  label: string;
  type?: "text" | "number";
}

/** Columns shown in the admin data table — editable fields + system metadata.
 * System columns (created_at / updated_at / last_synced_at / raw_data_size)
 * only render when the row actually has them; vehicle_models doesn't have them. */
export const SYSTEM_FIELDS: FieldDef[] = [
  { k: "id", label: "id" },
  { k: "last_synced_at", label: "最后同步" },
  { k: "updated_at", label: "最后更新" },
  { k: "created_at", label: "创建时间" },
  { k: "raw_data_size", label: "原始数据" },
];

export const RESOURCES: Record<
  ResourceSlug,
  { label: string; fields: FieldDef[] }
> = {
  vehicles: {
    label: "车型",
    fields: [
      { k: "brand", label: "品牌" },
      { k: "name", label: "名称" },
      { k: "category", label: "分类" },
      { k: "image", label: "图片" },
      { k: "model_index", label: "序号", type: "number" },
    ],
  },
  motors: {
    label: "电机",
    fields: [
      { k: "brand", label: "品牌" },
      { k: "name", label: "名称" },
      { k: "type", label: "类型" },
      { k: "color", label: "颜色" },
      { k: "size", label: "尺寸" },
      { k: "concise", label: "简述" },
      { k: "describe", label: "描述" },
      { k: "picsrc1", label: "主图" },
      { k: "picsrc2", label: "线稿" },
      { k: "top_time", label: "置顶时间" },
    ],
  },
  parts: {
    label: "配件",
    fields: [
      { k: "type", label: "类型" },
      { k: "brand", label: "品牌" },
      { k: "name", label: "名称" },
      { k: "concise", label: "简述" },
      { k: "size", label: "尺寸" },
      { k: "color", label: "颜色" },
      { k: "product_id", label: "产品ID" },
      { k: "body_angle", label: "车身角度" },
      { k: "position", label: "位置" },
      { k: "describe", label: "描述" },
      { k: "top_time", label: "置顶时间" },
    ],
  },
  additems: {
    label: "附加项",
    fields: [
      { k: "brand", label: "品牌" },
      { k: "name", label: "名称" },
      { k: "type", label: "类型" },
      { k: "car_name", label: "车型名" },
      { k: "product_id", label: "产品ID" },
      { k: "picsrc", label: "图" },
      { k: "describe", label: "描述" },
      { k: "price", label: "价格" },
    ],
  },
};

/** The columns displayed in the admin data table — editable fields plus
 * whichever system columns apply. Vehicles have no sync timestamps so
 * we skip those; motors/parts/additems get all system columns. */
export function getDisplayFields(slug: ResourceSlug): FieldDef[] {
  const base = RESOURCES[slug].fields;
  if (slug === "vehicles") {
    return [{ k: "id", label: "id" }, ...base];
  }
  return [...base, ...SYSTEM_FIELDS];
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function adminJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  return adminFetch<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─── CRUD ────────────────────────────────────────────────────

export async function listRows<T>(
  slug: ResourceSlug,
  filters: Record<string, string> = {},
  page = 1,
  pageSize = 100,
): Promise<ListResponse<T>> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const r = await adminFetch<ApiResult<ListResponse<T>>>(`/admin/${slug}?${params}`);
  return r.data!;
}

export async function getRow<T>(slug: ResourceSlug, id: number): Promise<T | null> {
  const r = await adminFetch<ApiResult<T>>(`/admin/${slug}/${id}`);
  return r.data ?? null;
}

export async function createRow<T>(slug: ResourceSlug, data: Partial<T>): Promise<T> {
  const r = await adminJson<ApiResult<T>>("POST", `/admin/${slug}`, data);
  if (r.stat !== "success") throw new Error(r.reason || "create failed");
  return r.data!;
}

export async function updateRow<T>(slug: ResourceSlug, id: number, data: Partial<T>): Promise<T> {
  const r = await adminJson<ApiResult<T>>("PATCH", `/admin/${slug}/${id}`, data);
  if (r.stat !== "success") throw new Error(r.reason || "update failed");
  return r.data!;
}

export async function deleteRow(slug: ResourceSlug, id: number): Promise<void> {
  const r = await adminJson<ApiResult<unknown>>("DELETE", `/admin/${slug}/${id}`);
  if (r.stat !== "success") throw new Error(r.reason || "delete failed");
}

// ─── Image upload ────────────────────────────────────────────

/** Field keys that hold image paths (resolved at /motomate/...). */
export const IMAGE_FIELDS = new Set(["image", "picsrc", "picsrc1", "picsrc2"]);

/** Upload an image file and return the saved /motomate/... path. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`upload returned ${res.status}`);
  const r = (await res.json()) as ApiResult<{ path: string }>;
  if (r.stat !== "success") throw new Error(r.reason || "upload failed");
  return r.data!.path;
}

// ─── Meta (distinct brands/types for the selective-sync form) ──

export interface MetaResponse {
  brands: {
    vehicles: string[];
    motors: string[];
    parts: string[];
    additems: string[];
  };
  types: {
    motors: string[];
    parts: string[];
    additems: string[];
  };
}

export async function getMeta(): Promise<MetaResponse> {
  const r = await adminFetch<ApiResult<MetaResponse>>(`/admin/meta`);
  return r.data!;
}

// ─── Sync ─────────────────────────────────────────────────────

export interface SyncResult {
  motors?: number;
  parts?: number;
  additems?: number;
  images?: number;
  skipped?: number;
  since?: string | null;
}

export interface SyncLogEntry {
  id: number;
  sync_type: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  motors_count: number;
  parts_count: number;
  additems_count: number;
  images_count: number;
  error_message: string;
}

export interface SelectiveSpec {
  brands?: string[];
  types?: string[];
  product_ids?: string[];
}

export interface SelectiveBody {
  motors?: SelectiveSpec;
  parts?: SelectiveSpec;
  additems?: SelectiveSpec;
  download_images?: boolean;
}

export async function syncFull(): Promise<SyncResult> {
  const r = await adminJson<ApiResult<SyncResult>>("POST", "/admin/sync/now");
  if (r.stat !== "success") throw new Error(r.reason || "sync failed");
  return r.result!;
}

export async function syncIncremental(): Promise<SyncResult> {
  const r = await adminJson<ApiResult<SyncResult>>("POST", "/admin/sync/incremental");
  if (r.stat !== "success") throw new Error(r.reason || "sync failed");
  return r.result!;
}

export async function syncSelective(body: SelectiveBody): Promise<SyncResult> {
  const r = await adminJson<ApiResult<SyncResult>>("POST", "/admin/sync/selective", body);
  if (r.stat !== "success") throw new Error(r.reason || "sync failed");
  return r.result!;
}

export async function getSyncHistory(limit = 20): Promise<SyncLogEntry[]> {
  const r = await adminFetch<ApiResult<SyncLogEntry[]>>(`/admin/sync/history?limit=${limit}`);
  return r.data ?? [];
}

// ─── Asset index ────────────────────────────────────────────

export interface AssetSummary {
  total: number;
  by_kind: Record<string, number>;
}

export async function getAssetSummary(): Promise<AssetSummary> {
  const r = await adminFetch<ApiResult<AssetSummary>>(`/admin/assets/summary`);
  return r.data!;
}

export async function reindexAssets(): Promise<{
  brand_name_pairs: number;
  upserted: number;
}> {
  const r = await adminJson<ApiResult<{ brand_name_pairs: number; upserted: number }>>(
    "POST",
    "/admin/assets/reindex",
  );
  if (r.stat !== "success") throw new Error(r.reason || "reindex failed");
  return r.data!;
}
