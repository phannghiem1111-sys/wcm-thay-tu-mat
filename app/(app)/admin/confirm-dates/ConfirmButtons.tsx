"use client";
import { useTransition } from "react";
import { resolveAll, resolveOne } from "./actions";

export function OneButton({ id, choice, children }: { id: string; choice: "asIs" | "swapped"; children: React.ReactNode }) {
  const [busy, start] = useTransition();
  return <button className="btn" disabled={busy} onClick={() => start(() => resolveOne(id, choice))}>{children}</button>;
}
export function AllButton({ choice, count, children }: { choice: "asIs" | "swapped"; count: number; children: React.ReactNode }) {
  const [busy, start] = useTransition();
  return (
    <button className="btn" disabled={busy} onClick={() => { if (confirm(`Áp dụng cho ${count} ngày?`)) start(() => resolveAll(choice)); }}>
      {busy ? "Đang xử lý…" : children}
    </button>
  );
}
