"use client";
import { useActionState, useState } from "react";
import { createUser, setAssignments, updateUser } from "./actions";

const ROLES: [string, string][] = [["VIEWER", "Người xem"], ["DOI_TRUONG", "Đội trưởng KTKV"], ["NHA_THAU", "Nhà thầu"], ["ADMIN", "Admin"]];
const Msg = ({ s }: { s?: { error?: string; ok?: string } }) => (s?.error ? <div className="err">{s.error}</div> : s?.ok ? <div className="okmsg">{s.ok}</div> : null);

export function CreateUserForm() {
  const [s, act, busy] = useActionState(createUser, undefined);
  return (
    <form action={act} className="card">
      <h3>Thêm người dùng</h3><Msg s={s} />
      <label className="f">Họ tên<input name="name" required /></label>
      <label className="f">Email<input name="email" type="email" required /></label>
      <label className="f">Mật khẩu ban đầu (≥ 8 ký tự)<input name="password" type="text" minLength={8} required /></label>
      <label className="f">Vai trò<select name="role" defaultValue="VIEWER">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <button className="btn pri" disabled={busy}>Tạo</button>
    </form>
  );
}

export function EditUserForm({ u }: { u: { id: string; name: string; role: string; active: boolean } }) {
  const [s, act, busy] = useActionState(updateUser, undefined);
  return (
    <form action={act} className="card">
      <h3>Thông tin & vai trò</h3><Msg s={s} />
      <input type="hidden" name="id" value={u.id} />
      <label className="f">Họ tên<input name="name" defaultValue={u.name} required /></label>
      <label className="f">Vai trò<select name="role" defaultValue={u.role}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="row small"><input type="checkbox" name="active" defaultChecked={u.active} style={{ width: "auto", minHeight: 0 }} /> Đang hoạt động</label>
      <label className="f" style={{ marginTop: 10 }}>Đặt lại mật khẩu (bỏ trống nếu không đổi)<input name="password" type="text" /></label>
      <button className="btn pri" disabled={busy}>Lưu</button>
    </form>
  );
}

type S = { id: string; site: string; tenCuaHang: string; tinh: string | null; doiTruongKtkv: string | null; nhaThauLapDat: string | null; nhaThauVanChuyen: string | null };
export function AssignForm({ userId, stores, assigned, groups }: { userId: string; stores: S[]; assigned: string[]; groups: { label: string; values: string[] }[] }) {
  const [s, act, busy] = useActionState(setAssignments, undefined);
  const [sel, setSel] = useState(new Set(assigned));
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pick = (pred: (x: S) => boolean) => setSel((p) => { const n = new Set(p); stores.filter(pred).forEach((x) => n.add(x.id)); return n; });
  return (
    <form action={act} className="card">
      <h3>Cửa hàng được gán ({sel.size})</h3>
      <p className="small muted">Chỉ cửa hàng được gán mới cho phép người này cập nhật. Chọn nhanh theo tên trong file:</p>
      <Msg s={s} />
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 8 }}>
          <div className="small muted">{g.label}</div>
          <div className="row">{g.values.map((v) => (
            <button type="button" key={v} className="btn sm" onClick={() => pick((x) => g.label.startsWith("Đội") ? x.doiTruongKtkv === v : x.nhaThauLapDat === v || x.nhaThauVanChuyen === v)}>+ {v}</button>
          ))}</div>
        </div>
      ))}
      <div className="row" style={{ margin: "8px 0" }}><button type="button" className="btn sm" onClick={() => setSel(new Set())}>Bỏ chọn tất cả</button></div>
      <input type="hidden" name="userId" value={userId} />
      <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: 8 }}>
        {stores.map((x) => (
          <label key={x.id} className="row small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" }}>
            <input type="checkbox" name="storeId" value={x.id} checked={sel.has(x.id)} onChange={() => toggle(x.id)} style={{ width: "auto", minHeight: 0 }} />
            <span><b>{x.site}</b> {x.tenCuaHang} <span className="muted">· {x.tinh} · {x.doiTruongKtkv ?? "—"}</span></span>
          </label>
        ))}
      </div>
      <button className="btn pri" style={{ marginTop: 10 }} disabled={busy}>Lưu phân công</button>
    </form>
  );
}
