import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage, assignedStoreIds } from "@/lib/auth";
import { can, canEditStore } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatMonthVN, formatVN, toISODate, todayVN } from "@/lib/dates";
import { dataFlags, isLate, STATUS_LABEL } from "@/lib/domain";
import { StatusChip } from "@/components/StatusChip";
import { COLUMNS } from "@/lib/import/parse";
import { canEditField } from "@/lib/permissions";
import { UPDATE_FIELDS } from "@/lib/update";
import { STATUS_ORDER } from "@/lib/domain";
import { UpdateForm } from "./UpdateForm";
import { Photos } from "./Photos";
import { sheetUrl } from "@/lib/sheets";

const LABEL = Object.fromEntries(COLUMNS.map(([k, l]) => [k, l])) as Record<string, string>;
const FIELD_LABEL: Record<string, string> = { VC_DU_KIEN: "Ngày VC - DỰ KIẾN", VC_THUC_TE: "Ngày VC - THỰC TẾ", LAP_DU_KIEN: "Ngày lắp - DỰ KIẾN", LAP_THUC_TE: "Ngày lắp - THỰC TẾ" };

export default async function StoreDetail({ params }: { params: Promise<{ site: string }> }) {
  const u = await requirePage(can.viewStoreDetail);
  const site = decodeURIComponent((await params).site);
  const s = await prisma.store.findUnique({
    where: { site },
    include: {
      dateConfirmations: { where: { resolvedAt: null } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true, email: true } } } },
      photos: { orderBy: { createdAt: "asc" } },
      assignments: { include: { user: { select: { name: true, role: true } } } },
    },
  });
  if (!s) notFound();
  const today = todayVN();
  const iso = { ngayVcDuKien: toISODate(s.ngayVcDuKien), ngayVcThucTe: toISODate(s.ngayVcThucTe), ngayLapDuKien: toISODate(s.ngayLapDuKien), ngayLapThucTe: toISODate(s.ngayLapThucTe) };
  const flags = dataFlags({ ...s, ...iso, pendingDates: s.dateConfirmations.length }, today);
  const late = isLate({ trangThai: s.trangThai, ngayLapDuKien: iso.ngayLapDuKien }, today);
  const editable = canEditStore(u, s.id, await assignedStoreIds(u.id));
  const pendingField = new Set(s.dateConfirmations.map((c) => c.field));

  const KV = ({ rows }: { rows: [string, React.ReactNode][] }) => (
    <dl className="kv">{rows.map(([k, v]) => <div className="r" key={k}><dt>{LABEL[k] ?? k}</dt><dd>{v || v === 0 ? v : <span className="muted">—</span>}</dd></div>)}</dl>
  );
  const Milestone = ({ n, label, dk, tt, field }: { n: number; label: string; dk: string | null; tt: string | null; field: string }) => (
    <li className={tt ? "done" : dk && dk < today ? "late" : ""}>
      <span className="dot">{tt ? "✓" : n}</span><b>{label}</b>
      <div className="small">Dự kiến: {formatVN(dk) || "—"} {pendingField.has(field as never) && <span className="chip flag">chờ xác nhận</span>}</div>
      <div className="small">Thực tế: {tt ? <b style={{ color: "var(--ok)" }}>{formatVN(tt)}</b> : <span className="muted">chưa có</span>}</div>
    </li>
  );
  const show = (v: unknown) => (v === null || v === undefined ? null : String(v));

  return (
    <>
      <p className="small"><Link href="/stores">← Danh sách</Link></p>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{s.tenCuaHang}</h2>
        <div className="small muted">{s.site} · {s.tinh} · Cập nhật {formatVN(s.ngayCapNhat.toISOString().slice(0, 10))}</div>
      </div>
      <div className="card statuscard">
        <div><div className="small muted">Trạng thái hiện tại</div><div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{STATUS_LABEL[s.trangThai]}</div></div>
        {late && iso.ngayLapDuKien ? <span className="chip late">Trễ {Math.max(1, Math.round((Date.parse(today) - Date.parse(iso.ngayLapDuKien)) / 86400000))} ngày</span> : <StatusChip s={s.trangThai} />}
      </div>
      <div className="card">
        {flags.length > 0 && <div className="warnmsg"><b>Kiểm tra dữ liệu:</b>{flags.map((f) => <div key={f}>• {f}</div>)}</div>}
        <p className="small muted" style={{ margin: 0 }}>
          {editable ? "Bạn được phép cập nhật cửa hàng này." : "Chỉ xem."}
          {s.assignments.length > 0 && <> Phân công: {s.assignments.map((a) => a.user.name).join(", ")}.</>}
        </p>
      </div>
      {editable && (
        <UpdateForm
          site={s.site}
          editable={UPDATE_FIELDS.filter((f) => canEditField(u.role, f))}
          statuses={STATUS_ORDER.map((k) => [k, STATUS_LABEL[k]])}
          initial={{ trangThai: s.trangThai, ngayVcThucTe: iso.ngayVcThucTe ?? "", ngayLapThucTe: iso.ngayLapThucTe ?? "", serialThucTe: s.serialThucTe ?? "", ghiChu: s.ghiChu ?? "" }}
        />
      )}
      <Photos site={s.site} canEdit={editable && canEditField(u.role, "photos")} storageReady={!!process.env.BLOB_READ_WRITE_TOKEN} photos={s.photos.map((p) => ({ id: p.id, url: p.url, mine: u.role === "ADMIN" || p.uploadedBy === u.id }))} />
      {sheetUrl() && <a className="btn big" href={sheetUrl()!} target="_blank" rel="noopener noreferrer" style={{ marginBottom: 12 }}>📊 Mở Google Sheets</a>}
      <div className="grid2">
        <div className="card"><h3>Mốc tiến độ</h3><ul className="tl">
          <Milestone n={1} label="Vận chuyển đến CH" dk={iso.ngayVcDuKien} tt={iso.ngayVcThucTe} field="VC_DU_KIEN" />
          <Milestone n={2} label="Lắp đặt hoàn thành" dk={iso.ngayLapDuKien} tt={iso.ngayLapThucTe} field="LAP_DU_KIEN" />
          <li className={s.trangThai === "DA_NGHIEM_THU" ? "done" : ""}><span className="dot">{s.trangThai === "DA_NGHIEM_THU" ? "✓" : 3}</span><b>Nghiệm thu</b><div className="small">{s.trangThai === "DA_NGHIEM_THU" ? "Đã nghiệm thu" : "Chưa"}</div></li>
        </ul></div>
        <div className="card"><h3>Cửa hàng</h3><KV rows={[
          ["stt", s.stt], ["phuTrachKhuVuc", s.phuTrachKhuVuc], ["tinh", s.tinh], ["thangKhaiTruong", formatMonthVN(s.thangKhaiTruong)],
          ["tinhCu", s.tinhCu], ["quanHuyenCu", s.quanHuyenCu], ["cht", s.cht], ["sdtCht", s.sdtCht ? <a href={`tel:${s.sdtCht.replace(/\s/g, "")}`}>{s.sdtCht}</a> : null],
        ]} /></div>
        <div className="card"><h3>Triển khai</h3><KV rows={[
          ["hienTrangMayNen", s.hienTrangMayNen], ["doiTruongKtkv", s.doiTruongKtkv], ["ktkv", s.ktkv], ["nhaThauLapDat", s.nhaThauLapDat], ["nhaThauVanChuyen", s.nhaThauVanChuyen], ["kmDenCh", show(s.kmDenCh)],
        ]} /></div>
        <div className="card"><h3>Thiết bị</h3><KV rows={[
          ["maTsXuatKho", s.maTsXuatKho], ["tenVatTu", s.tenVatTu], ["article", s.article], ["nhaCungCap", s.nhaCungCap], ["model", s.model],
          ["serialGoc", s.serialGoc], ["serialThucTe", s.serialThucTe], ["xuatXu", s.xuatXu], ["dvt", s.dvt], ["soLuong", s.soLuong],
        ]} /></div>
      </div>
      <div className="card"><h3>Ghi chú & hồ sơ</h3><KV rows={[["ghiChu", s.ghiChu], ["linkHoSo", s.linkHoSo ? <a href={s.linkHoSo} target="_blank" rel="noopener noreferrer">Mở link</a> : null]]} /></div>
      {s.dateConfirmations.length > 0 && (
        <div className="card"><h3>Ngày chờ xác nhận</h3>
          {s.dateConfirmations.map((c) => <div key={c.id} className="small">{FIELD_LABEL[c.field]}: như file {formatVN(c.valueAsIs) || "(không hợp lệ)"} · nếu đảo {formatVN(c.valueSwapped) || "—"}</div>)}
          {u.role === "ADMIN" && <Link className="btn sm" style={{ marginTop: 8 }} href="/admin/confirm-dates">Xác nhận</Link>}
        </div>
      )}
      <div className="card"><h3>Lịch sử thay đổi</h3>
        {s.auditLogs.length === 0 && <p className="small muted">Chưa có thay đổi.</p>}
        {s.auditLogs.map((a) => (
          <div key={String(a.id)} className="audit">
            <div className="when">{a.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · <b>{a.user?.name ?? "Hệ thống"}</b> · {a.action}</div>
            {a.changes && typeof a.changes === "object" && Object.entries(a.changes as Record<string, { old: unknown; new: unknown }>).map(([k, v]) => (
              <div key={k}>{LABEL[k] ?? k}: {String(v.old ?? "(trống)")} → <b>{String(v.new ?? "(trống)")}</b></div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
