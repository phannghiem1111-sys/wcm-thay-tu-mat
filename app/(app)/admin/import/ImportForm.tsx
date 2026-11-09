"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { commitImport, previewImport, type PreviewState } from "./actions";
import type { RowIssue } from "@/lib/import/parse";

const fd = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

function Issues({ title, items, color }: { title: string; items: RowIssue[]; color: string }) {
  if (!items.length) return null;
  return (
    <>
      <h3 style={{ color, marginTop: 12 }}>{title} ({items.length})</h3>
      <div className="scroll-x"><table className="t"><thead><tr><th>Dòng</th><th>Site</th><th>Cột</th><th>Nội dung</th></tr></thead>
        <tbody>{items.map((x, i) => <tr key={i}><td>{x.row || "—"}</td><td>{x.site}</td><td>{x.column}</td><td>{x.message}</td></tr>)}</tbody></table></div>
    </>
  );
}

export function ImportForm() {
  const file = useRef<HTMLInputElement>(null);
  const [pv, setPv] = useState<PreviewState | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const data = () => { const f = new FormData(); f.set("file", file.current!.files![0]); return f; };

  const onPick = () => { setMsg(null); if (!file.current?.files?.[0]) return; start(async () => setPv(await previewImport(data()))); };
  const onCommit = () => start(async () => {
    const r = await commitImport(data());
    if (r.ok) { setMsg({ ok: true, text: `Đã nhập: ${r.summary.created} mới, ${r.summary.updated} cập nhật, ${r.summary.unchanged} không đổi. ${r.summary.pendingDates} ngày cần xác nhận. ${r.skipped} dòng lỗi bị bỏ qua.` }); setPv(null); if (file.current) file.current.value = ""; }
    else setMsg({ ok: false, text: r.error });
  });

  const res = pv?.ok ? pv.result : null;
  const nNew = res && pv?.ok ? res.rows.filter((r) => !pv.existing.includes(r.site)).length : 0;
  return (
    <>
      <div className="card">
        <p className="small muted">Đọc sheet <b>“Tổng hợp”</b>, khớp theo cột <b>Site</b>. Ô trống trong file không xoá dữ liệu đã có. Ngày nghi đảo ngày/tháng được <b>giữ nguyên</b> và đưa vào <Link href="/admin/confirm-dates">danh sách cần xác nhận</Link>.</p>
        <label className="btn pri big">{busy ? "Đang xử lý…" : "Chọn file .xlsx"}<input ref={file} type="file" accept=".xlsx,.xls" className="hide" onChange={onPick} disabled={busy} /></label>
      </div>
      {msg && <div className={msg.ok ? "okmsg" : "err"}>{msg.text} {msg.ok && <Link href="/admin/confirm-dates">Xác nhận ngày →</Link>}</div>}
      {pv && !pv.ok && <div className="err">{pv.error}</div>}
      {res && (
        <div className="card">
          <h3>Kết quả đọc file</h3>
          <div className={res.rows.length ? "okmsg" : "err"}>{res.rows.length} dòng hợp lệ ({nNew} mới, {res.rows.length - nNew} cập nhật) · sheet “{res.sheet}”</div>
          {res.missingColumns.length > 0 && <div className="warnmsg">Thiếu cột: {res.missingColumns.join(", ")}</div>}
          {res.unknownColumns.length > 0 && <div className="warnmsg">Cột không nhận diện (bỏ qua): {res.unknownColumns.join(", ")}</div>}
          <Issues title="Lỗi — dòng bị bỏ qua" items={res.errors} color="var(--bad)" />
          <Issues title="Cảnh báo — vẫn nhập" items={res.warnings} color="var(--warn)" />
          {res.pending.length > 0 && (
            <>
              <h3 style={{ marginTop: 12 }}>Ngày cần xác nhận ({res.pending.length})</h3>
              <p className="small muted">Lưu theo giá trị như file; Admin xác nhận sau khi nhập.</p>
              <div className="scroll-x"><table className="t"><thead><tr><th>Dòng</th><th>Site</th><th>Cột</th><th>Như file</th><th>Nếu đảo</th></tr></thead>
                <tbody>{res.pending.map((p, i) => <tr key={i}><td>{p.row}</td><td>{p.site}</td><td>{p.column}</td><td>{fd(p.asIs) || "(không hợp lệ)"}</td><td>{fd(p.swapped)}</td></tr>)}</tbody></table></div>
            </>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn pri" onClick={onCommit} disabled={busy || !res.rows.length}>{busy ? "Đang nhập…" : `Nhập ${res.rows.length} cửa hàng`}</button>
            <button className="btn" onClick={() => setPv(null)} disabled={busy}>Huỷ</button>
          </div>
        </div>
      )}
    </>
  );
}
