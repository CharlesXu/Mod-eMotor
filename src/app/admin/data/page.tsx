"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RESOURCES,
  getDisplayFields,
  type FieldDef,
  type ResourceSlug,
  type Row,
  createRow,
  deleteRow,
  listRows,
  updateRow,
  IMAGE_FIELDS,
  uploadImage,
} from "@/lib/adminApi";
import { ACCENT, AccentButton, Panel, SectionHeading } from "@/components/admin/ui";

type EditTarget = { mode: "new" } | { mode: "edit"; row: Row } | null;
type EditTargetNN = { mode: "new" } | { mode: "edit"; row: Row };

export default function DataPage() {
  const [tab, setTab] = useState<ResourceSlug>("vehicles");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<EditTarget>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const refreshList = useCallback(async (slug: ResourceSlug, f = "") => {
    setListLoading(true);
    setListError(null);
    try {
      const filters: Record<string, string> = {};
      if (f) filters.brand = f;
      const res = await listRows<Row>(slug, filters, 1, 200);
      setRows(res.data);
      setTotal(res.total);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshList(tab, filter);
  }, [tab, filter, refreshList]);

  const onSave = async (data: Record<string, unknown>) => {
    if (!edit) return;
    try {
      if (edit.mode === "new") {
        await createRow<Row>(tab, data);
        flash("已新增");
      } else {
        await updateRow<Row>(tab, edit.row.id, data);
        flash("已保存");
      }
      setEdit(null);
      refreshList(tab, filter);
    } catch (e) {
      flash(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("确认删除这一行？")) return;
    try {
      await deleteRow(tab, id);
      flash("已删除");
      refreshList(tab, filter);
    } catch (e) {
      flash(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const editableFields = RESOURCES[tab].fields;
  const displayFields = getDisplayFields(tab);

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <SectionHeading title="数据管理" hint={`${RESOURCES[tab].label} · 共 ${total} 条`} />
          <div className="ml-auto flex flex-wrap gap-1">
            {(Object.keys(RESOURCES) as ResourceSlug[]).map((slug) => {
              const active = tab === slug;
              return (
                <button
                  key={slug}
                  onClick={() => setTab(slug)}
                  className="rounded-md px-3 py-1.5 text-sm transition"
                  style={
                    active
                      ? { background: ACCENT, color: "#fff" }
                      : { background: "var(--motomate-soft)", color: "var(--motomate-accent)" }
                  }
                >
                  {RESOURCES[slug].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="按品牌筛选…"
            className="w-48 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <div className="flex-1" />
          <AccentButton onClick={() => setEdit({ mode: "new" })}>+ 新增</AccentButton>
        </div>

        {listError && (
          <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{listError}</div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                {displayFields.map((f) => (
                  <th key={f.k} className="py-2 pr-3">
                    {f.label}
                  </th>
                ))}
                <th className="sticky right-0 z-10 whitespace-nowrap bg-white py-2 pl-3 pr-3 text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && (
                <tr>
                  <td colSpan={displayFields.length + 1} className="py-4 text-center text-slate-400">
                    加载中…
                  </td>
                </tr>
              )}
              {!listLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={displayFields.length + 1} className="py-4 text-center text-slate-400">
                    无数据
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="group border-b border-slate-100 hover:bg-[var(--motomate-soft)]">
                  {displayFields.map((f) => (
                    <Cell key={f.k} field={f} row={row} />
                  ))}
                  <td className="sticky right-0 z-10 whitespace-nowrap bg-white py-2 pl-3 pr-3 text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)] group-hover:bg-[var(--motomate-soft)]">
                    <button
                      onClick={() => setEdit({ mode: "edit", row })}
                      className="mr-2 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:border-slate-500 hover:text-slate-900"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => onDelete(row.id)}
                      className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-500 hover:border-red-400 hover:text-red-700"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {edit && (
        <EditDialog
          slug={tab}
          target={edit}
          onClose={() => setEdit(null)}
          onSave={onSave}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-md px-4 py-2 text-sm text-white shadow-lg"
          style={{ background: ACCENT }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

/** Per-cell renderer — handles empty values, image thumbnails, timestamps,
 * raw_data size, and plain text truncation. */
function Cell({ field, row }: { field: FieldDef; row: Row }) {
  const raw = row[field.k];
  const isEmpty = raw === undefined || raw === null || raw === "";

  // id
  if (field.k === "id") {
    return (
      <td className="py-2 pr-3 font-mono text-xs text-slate-400">{raw as number}</td>
    );
  }

  // Empty cell → placeholder
  if (isEmpty) {
    return (
      <td className="py-2 pr-3 text-slate-300" title="空">
        —
      </td>
    );
  }

  // Timestamps
  if (
    field.k === "created_at" ||
    field.k === "updated_at" ||
    field.k === "last_synced_at"
  ) {
    const d = new Date(raw as string);
    const str = Number.isNaN(d.getTime())
      ? String(raw)
      : d.toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
    return (
      <td className="whitespace-nowrap py-2 pr-3 text-xs text-slate-500" title={String(raw)}>
        {str}
      </td>
    );
  }

  // raw_data size indicator
  if (field.k === "raw_data_size") {
    const size = raw as number;
    const label = size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;
    return (
      <td className="py-2 pr-3 text-xs">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500">
          {label}
        </span>
      </td>
    );
  }

  const str = String(raw);

  // Image fields with resolvable /motomate/... path → thumbnail + path text
  const isImage =
    field.k === "image" ||
    field.k === "picsrc" ||
    field.k.endsWith("src1") ||
    field.k.endsWith("src2");
  const resolvable = str.startsWith("/motomate/");
  if (isImage && resolvable) {
    return (
      <td className="py-2 pr-3" title={str}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={str}
            alt=""
            className="h-10 w-10 shrink-0 rounded border border-slate-200 object-cover"
          />
          <span className="max-w-[180px] truncate text-xs">{str}</span>
        </div>
      </td>
    );
  }

  // Plain text — truncated with title
  return (
    <td className="max-w-[220px] truncate py-2 pr-3" title={str}>
      {str}
    </td>
  );
}

function EditDialog({
  slug,
  target,
  onClose,
  onSave,
}: {
  slug: ResourceSlug;
  target: EditTargetNN;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const fields = RESOURCES[slug].fields;
  const initial: Record<string, unknown> = target.mode === "edit" ? { ...target.row } : {};
  const [data, setData] = useState<Record<string, unknown>>(initial);
  const [uploading, setUploading] = useState<string | null>(null);

  const handleUpload = async (fieldKey: string, file: File) => {
    setUploading(fieldKey);
    try {
      const path = await uploadImage(file);
      setData({ ...data, [fieldKey]: path });
    } catch (e) {
      console.error("Upload failed:", e);
      alert(`上传失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="font-medium">
            {target.mode === "new" ? "新增" : "编辑"} · {RESOURCES[slug].label}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </header>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {fields.map((f) => {
            if (IMAGE_FIELDS.has(f.k)) {
              const raw = data[f.k];
              const path = raw === undefined || raw === null ? "" : String(raw);
              const showPreview = path.startsWith("/motomate/");
              return (
                <div key={f.k}>
                  <div className="mb-1 text-xs font-medium text-slate-600">{f.label}</div>
                  {showPreview && (
                    <div className="mb-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={path}
                        alt=""
                        className="h-16 w-16 rounded border border-slate-200 object-cover"
                      />
                      <span className="max-w-[200px] truncate text-xs text-slate-500">{path}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={path}
                      onChange={(e) => setData({ ...data, [f.k]: e.target.value })}
                      placeholder="/motomate/..."
                      className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <label
                      className={`cursor-pointer rounded border px-2.5 py-1.5 text-sm transition ${
                        uploading === f.k
                          ? "border-slate-200 bg-slate-50 text-slate-400"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {uploading === f.k ? "上传中…" : "上传"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        className="hidden"
                        disabled={uploading !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(f.k, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            }
            return (
              <label key={f.k} className="block">
                <div className="mb-1 text-xs font-medium text-slate-600">{f.label}</div>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={data[f.k] === undefined || data[f.k] === null ? "" : String(data[f.k])}
                  onChange={(e) =>
                    setData({
                      ...data,
                      [f.k]:
                        f.type === "number"
                          ? e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                          : e.target.value,
                    })
                  }
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
            );
          })}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
          >
            取消
          </button>
          <AccentButton onClick={() => onSave(data)}>保存</AccentButton>
        </footer>
      </div>
    </div>
  );
}
