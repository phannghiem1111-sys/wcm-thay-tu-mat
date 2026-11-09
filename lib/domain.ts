// Logic nghiệp vụ thuần (không phụ thuộc DB) — được test trong tests/*.test.ts
import type { Role, StoreStatus } from "@prisma/client";

export const STATUS_ORDER: StoreStatus[] = [
  "CHUA_CAP_NHAT",
  "CHUA_XUAT_KHO",
  "DANG_VAN_CHUYEN",
  "DA_DEN_CH",
  "DANG_LAP",
  "HOAN_THANH",
  "DA_NGHIEM_THU",
];

export const STATUS_LABEL: Record<StoreStatus, string> = {
  CHUA_CAP_NHAT: "Chưa cập nhật",
  CHUA_XUAT_KHO: "Chưa xuất kho",
  DANG_VAN_CHUYEN: "Đang vận chuyển",
  DA_DEN_CH: "Đã đến CH",
  DANG_LAP: "Đang lắp",
  HOAN_THANH: "Hoàn thành",
  DA_NGHIEM_THU: "Đã nghiệm thu",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  DOI_TRUONG: "Đội trưởng KTKV",
  NHA_THAU: "Nhà thầu",
  VIEWER: "Người xem",
};

export const normText = (s: unknown) =>
  String(s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

export function parseStatus(label: unknown): StoreStatus | null {
  const n = normText(label);
  if (!n) return null;
  const hit = STATUS_ORDER.find((s) => normText(STATUS_LABEL[s]) === n);
  return hit ?? null;
}

export const statusIndex = (s: StoreStatus) => STATUS_ORDER.indexOf(s);
export const isDone = (s: StoreStatus) => s === "HOAN_THANH" || s === "DA_NGHIEM_THU";

/** ISO yyyy-mm-dd (hoặc null) */
export type ISODate = string | null;

/** Trễ tiến độ: ngày lắp dự kiến đã qua (trước hôm nay) và chưa hoàn thành */
export function isLate(s: { trangThai: StoreStatus; ngayLapDuKien: ISODate }, today: string): boolean {
  return !!s.ngayLapDuKien && s.ngayLapDuKien < today && !isDone(s.trangThai);
}

/** Tổng = Số lượng × (ĐG tài sản + ĐG vận chuyển + ĐG lắp đặt) */
export function storeTotal(s: { soLuong: number; donGiaTaiSan: number; donGiaVanChuyen: number; donGiaLapDat: number }): number {
  return (s.soLuong || 0) * ((s.donGiaTaiSan || 0) + (s.donGiaVanChuyen || 0) + (s.donGiaLapDat || 0));
}

/** Tỷ lệ % làm tròn 1 chữ số thập phân; mẫu số 0 => 0 */
export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part * 1000) / whole) / 10;
}

// ---------- Dashboard ----------
export type DashStore = {
  site: string;
  trangThai: StoreStatus;
  ngayLapDuKien: ISODate;
  tinh: string | null;
  doiTruongKtkv: string | null;
  phuTrachKhuVuc: string | null;
  total: number;
};
export type GroupStat = { key: string; total: number; done: number; late: number; pct: number };

export function groupStats(stores: DashStore[], key: "tinh" | "doiTruongKtkv" | "phuTrachKhuVuc", today: string): GroupStat[] {
  const m = new Map<string, GroupStat>();
  for (const s of stores) {
    const k = (s[key] ?? "").trim() || "(Chưa có)";
    const g = m.get(k) ?? { key: k, total: 0, done: 0, late: 0, pct: 0 };
    g.total++;
    if (isDone(s.trangThai)) g.done++;
    if (isLate(s, today)) g.late++;
    m.set(k, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, pct: percent(g.done, g.total) }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, "vi"));
}

export function computeDashboard(stores: DashStore[], today: string) {
  const total = stores.length;
  const done = stores.filter((s) => isDone(s.trangThai)).length;
  const late = stores.filter((s) => isLate(s, today));
  const byStatus = STATUS_ORDER.map((st) => ({ status: st, label: STATUS_LABEL[st], count: stores.filter((s) => s.trangThai === st).length }));
  const value = stores.reduce((a, s) => a + s.total, 0);
  const valueDone = stores.filter((s) => isDone(s.trangThai)).reduce((a, s) => a + s.total, 0);
  return {
    total,
    done,
    donePct: percent(done, total),
    late: late.length,
    latePct: percent(late.length, total),
    lateSites: late.map((s) => s.site),
    byStatus,
    value,
    valueDone,
    byTinh: groupStats(stores, "tinh", today),
    byDoiTruong: groupStats(stores, "doiTruongKtkv", today),
    byPhuTrach: groupStats(stores, "phuTrachKhuVuc", today),
  };
}

// ---------- Cờ lỗi dữ liệu ("Kiểm tra dữ liệu") ----------
export type FlagStore = {
  site: string;
  trangThai: StoreStatus;
  doiTruongKtkv: string | null;
  nhaThauLapDat: string | null;
  nhaThauVanChuyen: string | null;
  sdtCht: string | null;
  ngayVcDuKien: ISODate;
  ngayVcThucTe: ISODate;
  ngayLapDuKien: ISODate;
  ngayLapThucTe: ISODate;
  serialThucTe: string | null;
  pendingDates?: number;
};
export function dataFlags(s: FlagStore, today: string, duplicateSerials?: Set<string>): string[] {
  const f: string[] = [];
  const i = statusIndex(s.trangThai);
  if (s.pendingDates) f.push("Ngày chờ xác nhận (nghi đảo ngày/tháng)");
  if (!s.doiTruongKtkv) f.push("Thiếu đội trưởng");
  if (!s.nhaThauLapDat) f.push("Thiếu NT lắp đặt");
  if (!s.nhaThauVanChuyen) f.push("Thiếu NT vận chuyển");
  if (!s.sdtCht) f.push("Thiếu SĐT CHT");
  if (!s.ngayVcDuKien || !s.ngayLapDuKien) f.push("Thiếu ngày dự kiến");
  if (s.ngayVcDuKien && s.ngayLapDuKien && s.ngayLapDuKien < s.ngayVcDuKien) f.push("Ngày lắp DK trước ngày VC DK");
  if (s.ngayVcThucTe && s.ngayLapThucTe && s.ngayLapThucTe < s.ngayVcThucTe) f.push("Ngày lắp TT trước ngày VC TT");
  if ((s.ngayVcThucTe && s.ngayVcThucTe > today) || (s.ngayLapThucTe && s.ngayLapThucTe > today)) f.push("Ngày thực tế ở tương lai");
  if (i >= statusIndex("DA_DEN_CH") && !s.ngayVcThucTe) f.push("Đã đến CH nhưng thiếu ngày VC thực tế");
  if (isDone(s.trangThai) && !s.ngayLapThucTe) f.push("Hoàn thành nhưng thiếu ngày lắp thực tế");
  if (isDone(s.trangThai) && !s.serialThucTe) f.push("Hoàn thành nhưng thiếu serial thực tế");
  if (s.serialThucTe && duplicateSerials?.has(normText(s.serialThucTe))) f.push("Serial thực tế bị trùng");
  return f;
}
export function findDuplicateSerials(stores: { serialThucTe: string | null }[]): Set<string> {
  const seen = new Set<string>(), dup = new Set<string>();
  for (const s of stores) {
    const k = normText(s.serialThucTe);
    if (!k) continue;
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return dup;
}

// ---------- Kiểm tra cập nhật trạng thái (dùng ở giai đoạn 2, test ngay) ----------
export type StatusUpdate = {
  role: Role;
  from: StoreStatus;
  to: StoreStatus;
  ngayVcThucTe: ISODate;
  ngayLapThucTe: ISODate;
  today: string;
};
export function validateStatusUpdate(u: StatusUpdate): string[] {
  const e: string[] = [];
  if (u.to === "DA_NGHIEM_THU" && u.from !== "DA_NGHIEM_THU" && !(u.role === "ADMIN" || u.role === "DOI_TRUONG"))
    e.push("Chỉ Admin hoặc Đội trưởng KTKV được xác nhận nghiệm thu");
  if (u.to === "DA_NGHIEM_THU" && u.from !== "HOAN_THANH" && u.from !== "DA_NGHIEM_THU")
    e.push("Phải Hoàn thành trước khi Nghiệm thu");
  if (statusIndex(u.to) >= statusIndex("DA_DEN_CH") && !u.ngayVcThucTe) e.push("Cần ngày vận chuyển thực tế");
  if (isDone(u.to) && !u.ngayLapThucTe) e.push("Cần ngày lắp đặt thực tế");
  if (u.ngayVcThucTe && u.ngayVcThucTe > u.today) e.push("Ngày vận chuyển thực tế không được ở tương lai");
  if (u.ngayLapThucTe && u.ngayLapThucTe > u.today) e.push("Ngày lắp thực tế không được ở tương lai");
  if (u.ngayVcThucTe && u.ngayLapThucTe && u.ngayLapThucTe < u.ngayVcThucTe) e.push("Ngày lắp không được trước ngày vận chuyển");
  return e;
}
