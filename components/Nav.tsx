"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4v8H3zM10 4h4v16h-4zM17 9h4v11h-4z" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0-12-4 4m4-4 4 4M4 17v3h16v-3" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>,
};

export function Nav({ role, pending }: { role: Role; pending: number }) {
  const p = usePathname();
  const tabs: [string, string, keyof typeof I, number?][] = [["/", "Tổng quan", "home"]];
  if (role !== "VIEWER") tabs.push(["/stores", "Danh sách", "list"]);
  if (role === "ADMIN") tabs.push(["/admin/import", "Import", "up", pending], ["/admin/users", "Người dùng", "user"]);
  const on = (h: string) => (h === "/" ? p === "/" : p.startsWith(h) || (h === "/admin/import" && p.startsWith("/admin/confirm")));
  return (
    <nav className="tabs">
      {tabs.map(([h, l, i, n]) => (
        <Link key={h} href={h} className={on(h) ? "on" : ""}>
          {I[i]}
          <span>{l}{n ? <span className="badge-dot">{n}</span> : null}</span>
        </Link>
      ))}
    </nav>
  );
}
