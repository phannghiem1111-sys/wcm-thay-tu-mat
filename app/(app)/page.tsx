import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadStoreViews } from "@/lib/stores";
import { computeDashboard, statusIndex, STATUS_LABEL, STATUS_ORDER, type GroupStat } from "@/lib/domain";
import { formatVN, addDaysISO } from "@/lib/dates";
import { formatPct } from "@/lib/format";
import { can } from "@/lib/permissions";
import { StatusChip } from "@/components/StatusChip";
import { QuickStatus } from "@/components/QuickStatus";
import { assignedStoreIds } from "@/lib/auth";
import { canEditField, canEditStore } from "@/lib/permissions";

export default async function Dashboard() {
  const u = await requireUser();
  const { today, stores } = await loadStoreViews();
  const linkable = can.viewStoreList(u);
  const mine = await assignedStoreIds(u.id);
  const canQuick = (id: string) => canEditField(u.role, "trangThai") && canEditStore(u, id, mine);
  const options = STATUS_ORDER.map((k) => [k, STATUS_LABEL[k]] as [string, string]);
  if (!stores.length)
    return (
      <div className="card">
        <h3>Chưa có dữ liệu</h3>
        <p className="muted">{u.role === "ADMIN" ? <>Vào <Link href="/admin/import">Import Excel</Link> để nạp danh sách cửa hàng.</> : "Admin chưa nhập dữ liệu."}</p>
      </div>
    );
  const d = computeDashboard(stores, today);
  const cnt = (st: string) => d.byStatus.find((b) => b.status === st)?.count ?? 0;
  const inProgress = cnt("DANG_LAP") + cnt("DANG_VAN_CHUYEN") + cnt("DA_DEN_CH");
  const notUpdated = cnt("CHUA_CAP_NHAT");
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
      <tr key={s.site}><td>{linkable ? <Link href={`/stores/${s.site}`}>{s.site}</Link> : s.site} <span className="small muted">{s.tinh}</span></td><td>{formatVN(s.ngayLapDuKien)}</td><td>{canQuick(s.id) ? <QuickStatus site={s.site} current={s.trangThai} label={STATUS_LABEL[s.trangThai]} cls={`st-${statusIndex(s.trangThai)}`} options={options} /> : <StatusChip s={s.trangThai} />}</td></tr>
    ))}</tbody></table>
  );

  return (
    <>
      {(u.role === "DOI_TRUONG" || u.role === "NHA_THAU") && mine.size === 0 && <div className="card small" style={{ borderColor: "#C62828", color: "#C62828" }}>Tài khoản chưa được gán cửa hàng nào nên chưa cập nhật được. Liên hệ Admin để gán.</div>}
      <div className="kpirow">
      <div className="card hero">
        <div className="muted">Tiến độ hoàn thành</div>
        <div className="heroline">
          <span className="num">{d.done}</span><span className="muted">/ {d.total} cửa hàng</span>
          <span className="heropct">{formatPct(d.donePct)}</span>
        </div>
        <div className="prog"><i style={{ width: `${d.donePct}%` }} /></div>
        <div className="muted herosub">Gồm cả cửa hàng đã nghiệm thu</div>
      </div>
      <div className="tiles">
        <L className="tile" href="/stores?status=DANG_LAP"><b style={{ color: "var(--brand)" }}>{inProgress}</b><span>Đang lắp / vận chuyển</span></L>
        <L className="tile" href="/stores?flag=late"><b style={{ color: "var(--bad)" }}>{d.late}</b><span>Trễ tiến độ</span></L>
        <L className="tile" href="/stores?status=CHUA_CAP_NHAT"><b style={{ color: "var(--muted)" }}>{notUpdated}</b><span>Chưa cập nhật</span></L>
      </div>
      </div>
      <div className="alerts">
      {d.late > 0 && (
        <L className="alert" href="/stores?flag=late"><b>{d.late} cửa hàng quá ngày lắp dự kiến</b><br />Xem danh sách để đội trưởng xử lý.</L>
      )}
      {pending > 0 && (
        <L className="alert" href={u.role === "ADMIN" ? "/admin/confirm-dates" : "/stores?flag=pending"}><b>Cần xác nhận ngày: {pending} cửa hàng</b><br />Ngày trong file có thể bị đảo ngày/tháng.</L>
      )}
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Theo trạng thái</h3>
          <div className="stack">
            {d.byStatus.filter((b) => b.count > 0).map((b) => <i key={b.status} style={{ width: `${(b.count * 100) / d.total}%`, background: color(statusIndex(b.status)) }} />)}
          </div>
          <div className="legend">
            {d.byStatus.map((b) => (
              <L key={b.status} href={`/stores?status=${b.status}`}><span className="dot" style={{ background: color(statusIndex(b.status)) }} />{STATUS_LABEL[b.status]} · {b.count}</L>
            ))}
          </div>
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
