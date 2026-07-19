/**
 * Shared admin UI primitives — styled to match the homepage motomate design
 * language (CSS vars --motomate-ink/accent/soft/line, dashed-border cards,
 * 3px-solid-ink section heading rules).
 */
import Link from "next/link";

export const INK = "var(--motomate-ink)";
export const ACCENT = "var(--motomate-accent)";
export const SOFT = "var(--motomate-soft)";
export const LINE = "var(--motomate-line)";

/** Page title block — mirrors .motomate-section-heading (3px ink rules). */
export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      className="flex items-baseline gap-3 border-y-[3px] px-1 py-2"
      style={{ borderColor: INK }}
    >
      <h2 className="text-[18px] font-semibold" style={{ color: INK }}>
        {title}
      </h2>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

/** Outer panel — white card with a soft line border. */
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border bg-white p-6 shadow-sm ${className}`}
      style={{ borderColor: LINE }}
    >
      {children}
    </section>
  );
}

/** Dashed model card — mirrors .motomate-model-card dashed border + rounded corner. */
export function DashedCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-b-[20px] border border-dashed p-4 ${className}`}
      style={{ borderColor: "rgba(65, 91, 117, 0.2)" }}
    >
      {children}
    </div>
  );
}

export function AccentButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ background: ACCENT }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  href,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const cls = `rounded-md border bg-white px-3 py-1.5 text-sm transition hover:bg-[var(--motomate-soft)] ${className}`;
  const style = { borderColor: "rgba(73, 92, 105, 0.34)", color: ACCENT };
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    success: "bg-emerald-100 text-emerald-700",
    running: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    partial: "bg-amber-100 text-amber-700",
  };
  const cls = map[status] || "bg-slate-100 text-slate-600";
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

export function fmt(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

/** Shared nav strip used by the admin layout + hub. */
export const ADMIN_NAV = [
  { href: "/admin/sync", label: "原站同步" },
  { href: "/admin/history", label: "同步历史" },
  { href: "/admin/data", label: "数据管理" },
];
