"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickStatus } from "@/app/(app)/stores/[site]/actions";

type Opt = [string, string];
/** Nhãn trạng thái bấm được: chọn nhanh tiến độ có sẵn. */
export function QuickStatus({ site, current, label, cls, options }: { site: string; current: string; label: string; cls: string; options: Opt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const pick = (k: string) => {
    if (k === current) { setOpen(false); return; }
    setErr(null);
    start(async () => {
      const r = await quickStatus(site, k);
      if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.errors.join(". "));
    });
  };
  return (
    <span className="qs">
      <button type="button" className={`chip ${cls} qs-btn`} disabled={busy} onClick={() => { setOpen((o) => !o); setErr(null); }} aria-haspopup="listbox" aria-expanded={open}>
        {busy ? "Đang lưu…" : label} ▾
      </button>
      {open && (
        <>
          <span className="qs-back" onClick={() => setOpen(false)} />
          <span className="qs-menu" role="listbox">
            {options.map(([k, l]) => (
              <button type="button" key={k} role="option" aria-selected={k === current} className={k === current ? "on" : ""} disabled={busy} onClick={() => pick(k)}>{l}</button>
            ))}
            {err && <span className="qs-err">{err}</span>}
          </span>
        </>
      )}
    </span>
  );
}
