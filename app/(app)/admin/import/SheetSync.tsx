"use client";
import { useState, useTransition } from "react";
import { syncAllNow } from "../../stores/[site]/actions";

export function SheetSync({ enabled, url }: { enabled: boolean; url: string | null }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="card">
      <h3>Google Sheets</h3>
      <p className="small muted">Mỗi lần cập nhật hoặc import, app tự ghi sang Sheet (Sheet chỉ để xem và sao lưu, dữ liệu chính ở app).</p>
      {!enabled && <div className="warnmsg">Chưa kết nối. Làm theo README mục “Google Sheets”, rồi đặt <code>SHEETS_WEBHOOK_URL</code> và <code>SHEETS_WEBHOOK_SECRET</code> trên Vercel.</div>}
      {msg && <div className={msg.ok ? "okmsg" : "err"}>{msg.text}</div>}
      <div className="row">
        <button className="btn pri" disabled={!enabled || busy} onClick={() => start(async () => { const r = await syncAllNow(); setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.errors.join(", ") }); })}>{busy ? "Đang đồng bộ…" : "Đồng bộ toàn bộ ngay"}</button>
        {url && <a className="btn" href={url} target="_blank" rel="noopener noreferrer">Mở Google Sheets</a>}
      </div>
    </div>
  );
}
