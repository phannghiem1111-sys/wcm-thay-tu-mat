"use client";
import { useActionState } from "react";
import { resetAllData } from "./resetAction";

export function ResetForm() {
  const [s, act, busy] = useActionState(resetAllData, undefined);
  return (
    <form action={act} className="card" onSubmit={(e) => { if (!window.confirm("Xoá TOÀN BỘ dữ liệu? Không thể hoàn tác.")) e.preventDefault(); }}>
      <h3>Xoá toàn bộ dữ liệu</h3>
      {s?.error ? <div className="err">{s.error}</div> : s?.ok ? <div className="okmsg">{s.ok}</div> : null}
      <p className="small muted">Xoá hết cửa hàng, tiến độ, ảnh, lịch sử cập nhật và mọi tài khoản khác (giữ tài khoản của bạn). Không thể hoàn tác.</p>
      <label className="f">Gõ <b>XOA HET</b> để xác nhận<input name="confirm" autoComplete="off" required /></label>
      <button className="btn" disabled={busy} style={{ color: "#b42318" }}>{busy ? "Đang xoá…" : "Xoá toàn bộ"}</button>
    </form>
  );
}
