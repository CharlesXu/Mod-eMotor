import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--motomate-soft)] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/admin"
            className="text-lg font-semibold"
            style={{ color: "var(--motomate-ink)" }}
          >
            电改模拟工具 · 管理后台
          </Link>
          <div className="flex items-center gap-6">
            <AdminNav />
            <Link
              href="/"
              className="text-sm text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline"
            >
              ← 返回模拟器
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">{children}</main>
    </div>
  );
}
