"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, INK } from "./ui";

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-4 py-1.5 text-sm transition"
            style={
              active
                ? { background: INK, color: "#fff" }
                : { color: "var(--motomate-accent)" }
            }
            data-active={active}
          >
            <span className={active ? "" : "hover:underline"}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
