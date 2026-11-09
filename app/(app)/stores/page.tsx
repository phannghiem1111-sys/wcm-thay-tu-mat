import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { filterStores, loadStoreViews, type ListFilters } from "@/lib/stores";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/domain";
import { formatVN } from "@/lib/dates";
import { StatusChip } from "@/components/StatusChip";
import { Filters } from "@/components/Filters";

const uniq = (a: (string | null)[]) => [...new Set(a.filter(Boolean) as string[])].sort((x, y) => x.localeCompare(y, "vi"));

export default async function StoreList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage(can.viewStoreList);
  const sp = await searchParams;
  const f: ListFilters = { q: sp.q, tinh: sp.tinh, status: sp.status, doiTruong: sp.doiTruong, nhaThau: sp.nhaThau, flag: sp.flag, phuTrach: sp.phuTrach, sort: sp.sort };
  const { stores } = await loadStoreViews();
  const rows = filterStores(stores, f);
  return (
    <>
      <h2>Cửa hàng <span className="muted" style={{ fontWeight: 500, fontSize: 16 }}>· {stores.length}</span></h2>
      <Filters
        tinh={uniq(stores.map((s) => s.tinh))}
        status={STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]])}
        doiTruong={uniq(stores.map((s) => s.doiTruongKtkv))}
        nhaThau={uniq(stores.flatMap((s) => [s.nhaThauLapDat, s.nhaThauVanChuyen]))}
      />
      <div className="chiprow">
        {([["", "Tất cả", {}], ["late", `Trễ tiến độ · ${stores.filter((x) => x.late).length}`, { flag: "late" }], ["DANG_LAP", "Đang lắp", { status: "DANG_LAP" }], ["CHUA_CAP_NHAT", "Chưa cập nhật", { status: "CHUA_CAP_NHAT" }], ["done", "Hoàn thành", { flag: "done" }]] as [string, string, Record<string, string>][]).map(([k, label, q]) => {
          const on = k === "" ? !f.flag && !f.status : (q.flag ? f.flag === q.flag : f.status === q.status);
          return <Link key={k || "all"} className={`fchip${on ? " on" : ""}`} href={k ? `/stores?${new URLSearchParams(q)}` : "/stores"}>{label}</Link>;
        })}
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="small muted">{rows.length}/{stores.length} cửa hàng{f.phuTrach ? ` · Phụ trách: ${f.phuTrach === "__none" ? "(chưa có)" : f.phuTrach}` : ""}</span>
        <Link className="btn sm" href="/stores">Xoá lọc</Link>
      </div>
      <div className="list">
        {rows.map((s) => (
          <Link key={s.site} className="item" href={`/stores/${encodeURIComponent(s.site)}`}>
            <div className="t1">
              <div><div className="name">{s.tenCuaHang}</div><div className="code">{s.site} · {s.tinh}{s.doiTruongKtkv ? ` · Đội: ${s.doiTruongKtkv}` : " · Chưa gán đội"}</div></div>
              {s.late ? <span className="chip late">Trễ tiến độ</span> : <StatusChip s={s.trangThai} />}
            </div>
            <div className="meta">
              <span>{s.late ? `Trạng thái: ${STATUS_LABEL[s.trangThai]}` : s.ngayLapThucTe ? `Lắp thực tế ${formatVN(s.ngayLapThucTe)}` : `VC DK ${formatVN(s.ngayVcDuKien) || "—"}`}</span>
              <span className={s.late ? "lt" : "tr"}>Lắp dự kiến {formatVN(s.ngayLapDuKien) || "—"}</span>
            </div>
            {(s.flags.length > 0 || s.pendingDates > 0) && (
              <div className="chips">
                {s.pendingDates > 0 && <span className="chip flag">Chờ xác nhận ngày</span>}
                {s.flags.length > 0 && <span className="chip flag" title={s.flags.join("\n")}>{s.flags.length} cờ lỗi</span>}
              </div>
            )}
          </Link>
        ))}
        {!rows.length && <p className="muted">Không có cửa hàng phù hợp.</p>}
      </div>
    </>
  );
}
