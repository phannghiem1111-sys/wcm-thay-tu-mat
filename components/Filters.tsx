"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

type Opt = [string, string];
export function Filters({ tinh, status, doiTruong, nhaThau, sites }: { tinh: string[]; status: Opt[]; doiTruong: string[]; nhaThau: string[]; sites: Opt[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const submit = () => {
    const fd = new FormData(form.current!);
    const q = new URLSearchParams();
    for (const [k, v] of fd) if (String(v)) q.set(k, String(v));
    if (sp.get("phuTrach")) q.set("phuTrach", sp.get("phuTrach")!);
    router.replace(`/stores${q.size ? `?${q}` : ""}`, { scroll: false });
  };
  const sel = (name: string, all: string, opts: Opt[]) => (
    <select name={name} defaultValue={sp.get(name) ?? ""} onChange={submit} aria-label={all}>
      <option value="">{all}</option>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const o = (a: string[]): Opt[] => a.map((x) => [x, x]);
  return (
    <form ref={form} className="filters" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input className="full" type="search" name="q" list="site-suggest" autoComplete="off" placeholder="Tìm tên cửa hàng hoặc mã Site" defaultValue={sp.get("q") ?? ""}
        onChange={() => { clearTimeout(timer.current); timer.current = setTimeout(submit, 300); }} />
      <datalist id="site-suggest">{sites.map(([code, name]) => <option key={code} value={code} label={name} />)}</datalist>
      {sel("tinh", "Tất cả tỉnh", o(tinh))}
      {sel("status", "Tất cả trạng thái", status)}
      {sel("doiTruong", "Tất cả đội trưởng", [...o(doiTruong), ["__none", "(Chưa có đội trưởng)"]])}
      {sel("nhaThau", "Tất cả nhà thầu", o(nhaThau))}
      {sel("flag", "Mọi tình trạng", [["todo", "Chưa hoàn thành"], ["done", "Đã hoàn thành"], ["late", "Trễ tiến độ"], ["flag", "Có cờ lỗi"], ["pending", "Chờ xác nhận ngày"]])}
      <select name="sort" defaultValue={sp.get("sort") ?? "ngayLapDuKien"} onChange={submit} aria-label="Sắp xếp">
        <option value="ngayLapDuKien">Ngày lắp DK ↑</option>
        <option value="ngayLapDuKien:desc">Ngày lắp DK ↓</option>
        <option value="ngayVcDuKien">Ngày VC DK ↑</option>
        <option value="ngayVcDuKien:desc">Ngày VC DK ↓</option>
        <option value="stt">Theo Stt</option>
      </select>
    </form>
  );
}
