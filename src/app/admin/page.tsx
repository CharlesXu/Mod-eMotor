"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSyncHistory, type SyncLogEntry } from "@/lib/adminApi";
import {
  ACCENT,
  DashedCard,
  GhostButton,
  Panel,
  SectionHeading,
  StatusBadge,
  fmt,
} from "@/components/admin/ui";

export default function AdminHub() {
  const [latest, setLatest] = useState<SyncLogEntry | null>(null);

  useEffect(() => {
    getSyncHistory(1)
      .then((h) => setLatest(h[0] ?? null))
      .catch(() => setLatest(null));
  }, []);

  return (
    <>
      <Panel>
        <SectionHeading title="管理后台" hint="选择一个板块开始" />
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <HubCard
            href="/admin/sync"
            title="原站同步"
            desc="完全 / 增量 / 选择数据三种复刻模式，按品牌、类型或 product_id 精确拉取。"
            cta="去同步"
          />
          <HubCard
            href="/admin/history"
            title="同步历史"
            desc="查看历次同步的类型、状态、各资源写入数量与错误信息。"
            cta="看历史"
          />
          <HubCard
            href="/admin/data"
            title="数据管理"
            desc="车型 / 电机 / 配件 / 附加项 四张表的增删改查。"
            cta="管数据"
          />
        </div>
      </Panel>

      <Panel>
        <SectionHeading title="最近一次同步" />
        {latest ? (
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
            <Field label="类型" value={latest.sync_type} />
            <Field label="状态">
              <StatusBadge status={latest.status} />
            </Field>
            <Field label="开始" value={fmt(latest.started_at)} />
            <Field label="结束" value={fmt(latest.finished_at)} />
            <Field
              label="写入"
              value={`m${latest.motors_count} / p${latest.parts_count} / a${latest.additems_count} / img${latest.images_count}`}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">暂无同步记录</p>
        )}
        <div className="mt-4">
          <GhostButton href="/admin/history">查看全部历史 →</GhostButton>
        </div>
      </Panel>
    </>
  );
}

function HubCard({
  href,
  title,
  desc,
  cta,
}: {
  href: string;
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <DashedCard className="flex flex-col">
      <h3 className="mb-1 text-base font-medium" style={{ color: ACCENT }}>
        {title}
      </h3>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      <Link
        href={href}
        className="self-start rounded-md px-4 py-2 text-sm text-white transition hover:opacity-90"
        style={{ background: ACCENT }}
      >
        {cta} →
      </Link>
    </DashedCard>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase text-slate-400">{label}</div>
      <div className="text-sm text-slate-700">{children ?? value}</div>
    </div>
  );
}
