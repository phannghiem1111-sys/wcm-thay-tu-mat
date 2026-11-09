"use client";
import { useState, useTransition } from "react";
import { updateStore } from "./actions";
import type { UpdateField } from "@/lib/update";

type Opt = [string, string];
export type UpdateFormProps = {
  site: string;
  editable: UpdateField[];
  statuses: Opt[];
  initial: { trangThai: string; ngayVcThucTe: string; ngayLapThucTe: string; serialThucTe: string; ghiChu: string };
};

export function UpdateForm({ site, editable, statuses, initial }: UpdateFormProps) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string[] } | null>(null);
  const can = (f: UpdateField) => editable.includes(f);
  const set = (k: keyof typeof initial, val: string) => setV((s) => ({ ...s, [k]: val }));

  const save = () =>
    start(async () => {
      const input: Record<string, string> = {};
      for (const f of editable) if (v[f] !== initial[f]) input[f] = v[f];
      const r = await updateStore(site, input);
      if (r.ok) { setMsg({ ok: true, text: [r.message] }); setOpen(false); }
      else setMsg({ ok: false, text: r.errors });
    });

  if (!open)
    return (
      <>
        {msg?.ok && <div className="okmsg">{msg.text[0]}</div>}
        <button className="btn pri big" onClick={() => { setMsg(null); setOpen(true); }}>Cập nhật tiến độ</button>
      </>
    );
  return (
    <div className="card">
      <h3>Cập nhật tiến độ</h3>
      {msg && !msg.ok && <div className="err">{msg.text.map((t) => <div key={t}>{t}</div>)}</div>}
      {can("trangThai") && (
        <label className="f">Trạng thái mới
          <div className="stgrid">
            {statuses.map(([k, l]) => (
              <button type="button" key={k} className={`stbtn${v.trangThai === k ? " on" : ""}`} onClick={() => set("trangThai", k)}>{l}</button>
            ))}
          </div>
        </label>
      )}
      <div className="inline">
        {can("ngayVcThucTe") && <label className="f">Ngày vận chuyển thực tế<input type="date" value={v.ngayVcThucTe} onChange={(e) => set("ngayVcThucTe", e.target.value)} /></label>}
        {can("ngayLapThucTe") && <label className="f">Ngày lắp thực tế<input type="date" value={v.ngayLapThucTe} onChange={(e) => set("ngayLapThucTe", e.target.value)} /></label>}
      </div>
      {can("serialThucTe") && <label className="f">Serial tủ thực tế<input value={v.serialThucTe} maxLength={60} onChange={(e) => set("serialThucTe", e.target.value)} placeholder="Nhập serial" /></label>}
      {can("ghiChu") && <label className="f">Ghi chú<textarea value={v.ghiChu} maxLength={1000} onChange={(e) => set("ghiChu", e.target.value)} /></label>}
      <div className="row">
        <button className="btn pri" disabled={busy} onClick={save}>{busy ? "Đang lưu…" : "Lưu cập nhật"}</button>
        <button className="btn" disabled={busy} onClick={() => { setV(initial); setMsg(null); setOpen(false); }}>Huỷ</button>
      </div>
    </div>
  );
}
