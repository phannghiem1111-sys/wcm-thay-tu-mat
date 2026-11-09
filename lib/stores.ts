import "server-only";
import type { Prisma, Store, StoreStatus } from "@prisma/client";
import { prisma } from "./db";
import { toISODate, todayVN } from "./dates";
import { dataFlags, findDuplicateSerials, isLate, storeTotal } from "./domain";

export type StoreView = {
  id: string;
  stt: number | null;
  site: string;
  tenCuaHang: string;
  phuTrachKhuVuc: string | null;
  tinh: string | null;
  doiTruongKtkv: string | null;
  nhaThauLapDat: string | null;
  nhaThauVanChuyen: string | null;
  sdtCht: string | null;
  trangThai: StoreStatus;
  ngayVcDuKien: string | null;
  ngayVcThucTe: string | null;
  ngayLapDuKien: string | null;
  ngayLapThucTe: string | null;
  serialThucTe: string | null;
  total: number;
  pendingDates: number;
  late: boolean;
  flags: string[];
};

export function toView(s: Store & { _count?: { dateConfirmations: number } }, today: string, dup: Set<string>): StoreView {
  const v = {
    id: s.id, stt: s.stt, site: s.site, tenCuaHang: s.tenCuaHang, phuTrachKhuVuc: s.phuTrachKhuVuc, tinh: s.tinh,
    doiTruongKtkv: s.doiTruongKtkv, nhaThauLapDat: s.nhaThauLapDat, nhaThauVanChuyen: s.nhaThauVanChuyen, sdtCht: s.sdtCht,
    trangThai: s.trangThai,
    ngayVcDuKien: toISODate(s.ngayVcDuKien), ngayVcThucTe: toISODate(s.ngayVcThucTe),
    ngayLapDuKien: toISODate(s.ngayLapDuKien), ngayLapThucTe: toISODate(s.ngayLapThucTe),
    serialThucTe: s.serialThucTe,
    total: storeTotal({ soLuong: s.soLuong, donGiaTaiSan: Number(s.donGiaTaiSan), donGiaVanChuyen: Number(s.donGiaVanChuyen), donGiaLapDat: Number(s.donGiaLapDat) }),
    pendingDates: s._count?.dateConfirmations ?? 0,
  };
  return { ...v, late: isLate(v, today), flags: dataFlags(v, today, dup) };
}

/** Tải tất cả cửa hàng (47 dòng — đủ nhỏ để lọc trong bộ nhớ) */
export async function loadStoreViews(where?: Prisma.StoreWhereInput) {
  const today = todayVN();
  const rows = await prisma.store.findMany({
    where,
    orderBy: [{ stt: "asc" }, { site: "asc" }],
    include: { _count: { select: { dateConfirmations: { where: { resolvedAt: null } } } } },
  });
  const dup = findDuplicateSerials(rows);
  return { today, stores: rows.map((r) => toView(r, today, dup)) };
}

export type ListFilters = { q?: string; tinh?: string; status?: string; doiTruong?: string; nhaThau?: string; flag?: string; phuTrach?: string; sort?: string };

const fold = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim();

export function filterStores(list: StoreView[], f: ListFilters): StoreView[] {
  const q = fold(f.q);
  const eqOrNone = (v: string | null, want?: string) => !want || (want === "__none" ? !v : (v ?? "") === want);
  const out = list.filter((s) =>
    (!q || fold(s.site).includes(q) || fold(s.tenCuaHang).includes(q)) &&
    eqOrNone(s.tinh, f.tinh) &&
    (!f.status || s.trangThai === f.status) &&
    eqOrNone(s.doiTruongKtkv, f.doiTruong) &&
    eqOrNone(s.phuTrachKhuVuc, f.phuTrach) &&
    (!f.nhaThau || s.nhaThauLapDat === f.nhaThau || s.nhaThauVanChuyen === f.nhaThau) &&
    (!f.flag ||
      (f.flag === "flag" && s.flags.length > 0) ||
      (f.flag === "late" && s.late) ||
      (f.flag === "pending" && s.pendingDates > 0) ||
      (f.flag === "done" && (s.trangThai === "HOAN_THANH" || s.trangThai === "DA_NGHIEM_THU")) ||
      (f.flag === "todo" && !(s.trangThai === "HOAN_THANH" || s.trangThai === "DA_NGHIEM_THU"))),
  );
  const [key, dir] = (f.sort || "ngayLapDuKien").split(":") as [string, string | undefined];
  const sign = dir === "desc" ? -1 : 1;
  out.sort((a, b) => {
    if (key === "stt") return (a.stt ?? 1e9) - (b.stt ?? 1e9);
    const k = key === "ngayVcDuKien" ? "ngayVcDuKien" : "ngayLapDuKien";
    const A = a[k], B = b[k];
    if (A === B) return (a.stt ?? 0) - (b.stt ?? 0);
    if (!A) return 1; // trống luôn xuống cuối
    if (!B) return -1;
    return sign * A.localeCompare(B);
  });
  return out;
}
