"use client";

import { useCallback, useEffect, useState } from "react";
import { getSyncHistory, type SyncLogEntry } from "@/lib/adminApi";
import { AccentButton, Panel, SectionHeading, StatusBadge, fmt } from "@/components/admin/ui";

export default function HistoryPage() {
  const [history, setHistory] = useState<SyncLogEntry[]>([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHistory(await getSyncHistory(limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <SectionHeading title="同步历史" hint={`${history.length} 条记录`} />
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value={20}>最近 20</option>
            <option value={50}>最近 50</option>
            <option value={100}>最近 100</option>
            <option value={500}>最近 500</option>
          </select>
          <AccentButton onClick={refresh} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </AccentButton>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">类型</th>
              <th className="py-2 pr-3">状态</th>
              <th className="py-2 pr-3">开始</th>
              <th className="py-2 pr-3">结束</th>
              <th className="py-2 pr-3">motors</th>
              <th className="py-2 pr-3">parts</th>
              <th className="py-2 pr-3">additems</th>
              <th className="py-2 pr-3">images</th>
              <th className="py-2 pr-3">错误</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="py-4 text-center text-slate-400">
                  暂无同步记录
                </td>
              </tr>
            )}
            {history.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 hover:bg-[var(--motomate-soft)]">
                <td className="py-2 pr-3 font-mono text-xs text-slate-400">{l.id}</td>
                <td className="py-2 pr-3 font-mono text-xs">{l.sync_type}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="py-2 pr-3 text-xs text-slate-500">{fmt(l.started_at)}</td>
                <td className="py-2 pr-3 text-xs text-slate-500">{fmt(l.finished_at)}</td>
                <td className="py-2 pr-3">{l.motors_count}</td>
                <td className="py-2 pr-3">{l.parts_count}</td>
                <td className="py-2 pr-3">{l.additems_count}</td>
                <td className="py-2 pr-3">{l.images_count}</td>
                <td
                  className="max-w-[260px] truncate py-2 pr-3 text-xs text-red-500"
                  title={l.error_message}
                >
                  {l.error_message || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
