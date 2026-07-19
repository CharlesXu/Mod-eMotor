/**
 * API client for the Mod-eMotor backend.
 *
 * In development, set NEXT_PUBLIC_API_BASE=http://localhost:3807
 * In Docker, the backend is available at http://backend:3807
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3807";

/** Create a multipart/form-data request body */
function createFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

async function apiPost<T>(path: string, fields: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: createFormData(fields),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────

export interface MotorInfo {
  brand: string;
  name: string;
  type: string;
  color: string;
  size: string;
  concise: string;
  describe: string;
  picsrc1: string;
  picsrc2: string;
  topTime: string;
}

export interface PartInfo {
  type: string;
  brand: string;
  name: string;
  concise: string;
  size: string;
  color: string;
  product_id: string;
  bodyAngle: string;
  position: string;
  describe: string;
  topTime: string;
}

export interface AddItemInfo {
  brand: string;
  name: string;
  type: string;
  car_name: string;
  product_id: string;
  picsrc: string;
  describe: string;
  price: string;
}

export interface GetToolsResponse {
  method: string;
  stat: "success" | "fail";
  data: string;
  motor_list?: MotorInfo[];
  reason?: string;
}

export interface GetPartListResponse {
  stat: string;
  data: string[];
}

export interface GetAddListResponse {
  stat: string;
  data: AddItemInfo[];
}

export interface VehicleModelInfo {
  index: number;
  name: string;
  image: string;
  category: string;
}

export interface CatalogBrand {
  brand: string;
  models: VehicleModelInfo[];
}

export interface GetCatalogResponse {
  stat: string;
  data: CatalogBrand[];
}

export interface SaveConfigResponse {
  stat: string;
  reason?: string;
}

// ─── API functions ────────────────────────────────────────

export async function getTools(
  encryptedCode: string,
  fingerprint = "",
  deviceInfo = "",
): Promise<GetToolsResponse> {
  return apiPost<GetToolsResponse>("/getTools", {
    data: JSON.stringify({
      type: "PC",
      c: fingerprint,
      d: deviceInfo,
      e: encryptedCode,
    }),
  });
}

export async function getPartList(): Promise<GetPartListResponse> {
  return apiPost<GetPartListResponse>("/getPartList");
}

export async function getCatalog(): Promise<GetCatalogResponse> {
  return apiPost<GetCatalogResponse>("/getCatalog");
}

export async function loadPartInfo(productId: string): Promise<{ stat: string; data: PartInfo }> {
  return apiPost("/loadPartInfo", { data: productId });
}

export async function getAddList(
  brand: string,
  carName = "",
): Promise<GetAddListResponse> {
  return apiPost<GetAddListResponse>("/getAddList", {
    time: String(Date.now()),
    belongCarBrand: brand,
    belongCarName: carName,
  });
}

export async function loadAdditemInfo(
  data: string,
): Promise<{ stat: string; data: AddItemInfo }> {
  return apiPost("/loadAdditemInfo", { data });
}

export async function recviceMotorInfo(
  config: Record<string, unknown>,
): Promise<SaveConfigResponse> {
  return apiPost<SaveConfigResponse>("/recviceMotorInfo", {
    data: JSON.stringify(config),
  });
}

// ─── Static data endpoints (served from backend src/data/) ──

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`fetch ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchCatalog(): Promise<CatalogBrand[]> {
  return fetchJson<CatalogBrand[]>("/api/data/catalog");
}

export async function fetchThumbnailAssets(): Promise<Record<string, string>> {
  return fetchJson<Record<string, string>>("/api/data/thumbnail-assets");
}

export async function fetchLineAssets(): Promise<Record<string, string>> {
  return fetchJson<Record<string, string>>("/api/data/line-assets");
}

export async function fetchPhotoAssets(): Promise<Record<string, string>> {
  return fetchJson<Record<string, string>>("/api/data/photo-assets");
}

export async function fetchMechanicalProfiles(): Promise<Record<string, { defaults: Record<string, unknown> }>> {
  return fetchJson<Record<string, { defaults: Record<string, unknown> }>>("/api/data/mechanical-profiles");
}

export async function fetchGeometryProfiles(): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>("/api/data/geometry-profiles");
}

export async function fetchAccessories(): Promise<unknown> {
  return fetchJson<unknown>("/api/data/accessories");
}