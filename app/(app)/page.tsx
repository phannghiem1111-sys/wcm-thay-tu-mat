import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadStoreViews } from "@/lib/stores";
import { computeDashboard, statusIndex, type GroupStat } from "@/lib/domain";
import { formatVN, addDaysISO } from "@/lib/dates";
import { formatPct, formatVND } from "@/lib/format";
import { can } from "@/lib/permissions";
import { StatusChip } from "@/components/StatusChip";

export default async function Dashboard() {
  const u = await requireUser();
  const { today, stores } = await loadStoreViews();
  const linkable = can.viewStoreList(u);
  if (!stores.length)
    return (
      <div className="card">
        <h3>Chưa có dữ liệu</h3>
        <p className="muted">{u.role === "ADMIN" ? <>Vào <Link href="/admin/import">Import Excel</Link> để nạp danh sách cửa hàng.</> : "Admin chưa nhập dữ liệu."}</p>
      </div>
    );
  const d = computeDashboard(stores, today);
  const flagged = stores.filter((s) => s.flags.length).length;
  const pending = stores.filter((s) => s.pendingDates).length;
  const in7 = addDaysISO(today, 7);
  const next7 = stores.filter((s) => s.ngayLapDuKien && s.ngayLapDuKien >= today && s.ngayLapDuKien <= in7 && !["HOAN_THANH", "DA_NGHIEM_THU"].includes(s.trangThai)).sort((a, b) => a.ngayLapDuKien!.localeCompare(b.ngayLapDuKien!));
  const late = stores.filter((s) => s.late).sort((a, b) => a.ngayLapDuKien!.localeCompare(b.ngayLapDuKien!));
  const L = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    linkable ? <Link className={className} href={href}>{children}</Link> : <div className={className}>{children}</div>;
  const color = (i: number) => (i >= 5 ? "var(--ok)" : i >= 2 ? "var(--info)" : i === 1 ? "var(--warn)" : "var(--muted)");

  const Group = ({ title, rows, param }: { title: string; rows: GroupStat[]; param: string }) => (
    <div className="card">
      <h3>Tiến độ theo {title}</h3>
      <div className="scroll-x">
        <table className="t">
          <thead><tr><th>{title[0].toUpperCase() + title.slice(1)}</th><th className="n">CH</th><th className="n">Xong</th><th className="n">Trễ</th><th style={{ minWidth: 100 }}>Tỷ lệ</th></tr></thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key}>
                <td>{linkable ? <Link href={`/stores?${param}=${encodeURIComponent(g.key === "(Chưa có)" ? "__none" : g.key)}`}>{g.key}</Link> : g.key}</td>
                <td className="n">{g.total}</td><td className="n">{g.done}</td>
                <td className="n" style={{ color: g.late ? "var(--bad)" : undefined }}>{g.late}</td>
                <td><div className="bar"><span className="prog"><i style={{ width: `${g.pct}%` }} /></span><span className="small">{formatPct(g.pct)}</span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  const MiniTable = ({ rows }: { rows: typeof stores }) => (
    <table className="t"><tbody>{rows.slice(0, 8).map((s) => (
      <tr key={s.site}><td>{linkable ? <Link href={`/stores/${s.site}`}>{s.site}</Link> : s.site} <span className="small muted">{s.tinh}</span></td><td>{formatVN(s.ngayLapDuKien)}</td><td><StatusChip s={s.trangThai} /></td></tr>
    ))}</tbody></table>
  );

  return (
    <>
      <div className="kpis">
        <L className="kpi" href="/stores"><div className="l">Tổng cửa hàng</div><div className="v">{d.total}</div><div className="s">{formatVND(d.value)}</div></L>
        <L className="kpi ok" href="/stores?flag=done"><div className="l">Hoàn thành (gồm đã nghiệm thu)</div><div className="v">{d.done} <span style={{ fontSize: 15 }}>· {formatPct(d.donePct)}</span></div><div className="prog" style={{ marginTop: 6 }}><i style={{ width: `${d.donePct}%` }} /></div></L>
        <L className="kpi bad" href="/stores?flag=late"><div className="l">Trễ tiến độ</div><div className="v">{d.late}</div><div className="s">Quá ngày lắp dự kiến, chưa hoàn thành</div></L>
        <L className="kpi warn" href="/stores?flag=flag"><div className="l">Có cờ lỗi dữ liệu</div><div className="v">{flagged}</div><div className="s">{pending} CH có ngày chờ xác nhận</div></L>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Theo trạng thái</h3>
          {d.byStatus.map((b) => (
            <L key={b.status} className="statusrow" href={`/stores?status=${b.status}`}>
              <span className="lbl"><StatusChip s={b.status} /></span>
              <span className="prog" style={{ flex: 1 }}><i style={{ width: `${(b.count * 100) / d.total}%`, background: color(statusIndex(b.status)) }} /></span>
              <span className="cnt">{b.count}</span>
            </L>
          ))}
          <p className="small muted" style={{ margin: "8px 0 0" }}>Giá trị đã hoàn thành: {formatVND(d.valueDone)} / {formatVND(d.value)}</p>
        </div>
        <div className="card">
          <h3>Lắp dự kiến 7 ngày tới ({next7.length})</h3>
          {next7.length ? <MiniTable rows={next7} /> : <p className="small muted">Không có.</p>}
          {late.length > 0 && (<><h3 style={{ marginTop: 12, color: "var(--bad)" }}>Trễ lâu nhất</h3><MiniTable rows={late} /></>)}
        </div>
      </div>
      <div className="grid2">
        <Group title="tỉnh" rows={d.byTinh} param="tinh" />
        <Group title="đội trưởng" rows={d.byDoiTruong} param="doiTruong" />
      </div>
      <Group title="phụ trách khu vực" rows={d.byPhuTrach} param="phuTrach" />
      <p className="small muted">Hôm nay {formatVN(today)}.</p>
    </>
  );
}
