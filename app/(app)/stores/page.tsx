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
      <h2>Danh sách cửa hàng</h2>
      <Filters
        tinh={uniq(stores.map((s) => s.tinh))}
        status={STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]])}
        doiTruong={uniq(stores.map((s) => s.doiTruongKtkv))}
        nhaThau={uniq(stores.flatMap((s) => [s.nhaThauLapDat, s.nhaThauVanChuyen]))}
      />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="small muted">{rows.length}/{stores.length} cửa hàng{f.phuTrach ? ` · Phụ trách: ${f.phuTrach === "__none" ? "(chưa có)" : f.phuTrach}` : ""}</span>
        <Link className="btn sm" href="/stores">Xoá lọc</Link>
      </div>
      <div className="list">
        {rows.map((s) => (
          <Link key={s.site} className="item" href={`/stores/${encodeURIComponent(s.site)}`}>
            <div className="t1"><span className="name">{s.tenCuaHang}</span><StatusChip s={s.trangThai} /></div>
            <div className="meta">
              <span><b>{s.site}</b></span><span>{s.tinh}</span>
              <span>VC DK {formatVN(s.ngayVcDuKien) || "—"}</span><span>Lắp DK {formatVN(s.ngayLapDuKien) || "—"}</span>
              {s.ngayLapThucTe && <span>Lắp TT {formatVN(s.ngayLapThucTe)}</span>}
            </div>
            <div className="chips">
              {s.late && <span className="chip late">Trễ</span>}
              {s.flags.length > 0 && <span className="chip flag" title={s.flags.join("\n")}>{s.flags.length} cờ lỗi</span>}
              {s.doiTruongKtkv && <span className="chip">{s.doiTruongKtkv}</span>}
            </div>
          </Link>
        ))}
        {!rows.length && <p className="muted">Không có cửa hàng phù hợp.</p>}
      </div>
    </>
  );
}
