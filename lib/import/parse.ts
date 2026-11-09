// Đọc file Excel (sheet "Tổng hợp") -> dữ liệu cửa hàng + lỗi từng dòng + ngày cần xác nhận.
import * as XLSX from "xlsx";
import type { DateField } from "@prisma/client";
import { parseDateCell } from "../dates";
import { normText, parseStatus } from "../domain";

type Kind = "text" | "int" | "decimal" | "money" | "date" | "month" | "status" | "phone";
export type StoreKey =
  | "stt" | "phuTrachKhuVuc" | "tinh" | "thangKhaiTruong" | "site" | "tenCuaHang" | "tinhCu" | "quanHuyenCu" | "cht" | "sdtCht"
  | "hienTrangMayNen" | "doiTruongKtkv" | "ktkv" | "nhaThauLapDat" | "nhaThauVanChuyen" | "kmDenCh"
  | "ngayVcDuKien" | "ngayVcThucTe" | "ngayLapDuKien" | "ngayLapThucTe" | "trangThai"
  | "maTsXuatKho" | "tenVatTu" | "article" | "nhaCungCap" | "model" | "serialGoc" | "serialThucTe" | "xuatXu" | "dvt"
  | "soLuong" | "donGiaTaiSan" | "donGiaVanChuyen" | "donGiaLapDat" | "ghiChu" | "linkHoSo";

/** [key, tên cột trong file (đúng chính tả), kiểu, alias bắt đầu bằng] */
export const COLUMNS: [StoreKey, string, Kind, string?][] = [
  ["stt", "Stt", "int"],
  ["phuTrachKhuVuc", "Phụ trách khu vực", "text"],
  ["tinh", "Tỉnh", "text"],
  ["thangKhaiTruong", "Tháng khai trương", "month"],
  ["site", "Site", "text"],
  ["tenCuaHang", "Tên cửa hàng", "text"],
  ["tinhCu", "Tỉnh/TP cũ (trước 1/7)", "text", "tỉnh/tp cũ"],
  ["quanHuyenCu", "Quận/huyện cũ (trước 1/7)", "text", "quận/huyện cũ"],
  ["cht", "CHT", "text"],
  ["sdtCht", "SĐT CHT", "phone"],
  ["hienTrangMayNen", "Hiện trạng cụm máy nén", "text"],
  ["doiTruongKtkv", "Đội trưởng KTKV", "text"],
  ["ktkv", "KTKV", "text"],
  ["nhaThauLapDat", "Nhà thầu lắp đặt", "text"],
  ["nhaThauVanChuyen", "Nhà thầu vận chuyển", "text"],
  ["kmDenCh", "Km đến CH", "decimal"],
  ["ngayVcDuKien", "Ngày VC - DỰ KIẾN", "date"],
  ["ngayVcThucTe", "Ngày VC - THỰC TẾ", "date"],
  ["ngayLapDuKien", "Ngày lắp - DỰ KIẾN", "date"],
  ["ngayLapThucTe", "Ngày lắp - THỰC TẾ", "date"],
  ["trangThai", "Trạng thái", "status"],
  ["maTsXuatKho", "Mã TS xuất kho", "text"],
  ["tenVatTu", "Tên vật tư", "text"],
  ["article", "Article", "text"],
  ["nhaCungCap", "Nhà cung cấp", "text"],
  ["model", "Model", "text"],
  ["serialGoc", "Serial (dữ liệu gốc)", "text", "serial (dữ liệu gốc"],
  ["serialThucTe", "Serial thực tế", "text"],
  ["xuatXu", "Xuất xứ", "text"],
  ["dvt", "ĐVT", "text"],
  ["soLuong", "Số lượng", "int"],
  ["donGiaTaiSan", "Đơn giá tài sản (-VAT)", "money", "đơn giá tài sản"],
  ["donGiaVanChuyen", "Đơn giá V/C (-VAT)", "money", "đơn giá v/c"],
  ["donGiaLapDat", "Đơn giá lắp đặt dự kiến", "money", "đơn giá lắp đặt"],
  ["ghiChu", "Ghi chú", "text"],
  ["linkHoSo", "Link ảnh / hồ sơ", "text", "link ảnh"],
];
const REQUIRED: StoreKey[] = ["site", "tenCuaHang"];
/** Các cột không có trong file mẫu vẫn chấp nhận được (Tổng, Ngày cập nhật, Kiểm tra dữ liệu tự tính) */

export const DATE_FIELD_MAP: Partial<Record<StoreKey, DateField>> = {
  ngayVcDuKien: "VC_DU_KIEN",
  ngayVcThucTe: "VC_THUC_TE",
  ngayLapDuKien: "LAP_DU_KIEN",
  ngayLapThucTe: "LAP_THUC_TE",
};

/** Giá trị đã chuẩn hoá: ngày dạng yyyy-mm-dd, số là number, trạng thái là mã enum StoreStatus */
export type ParsedStore = { site: string; tenCuaHang: string } & Partial<Record<Exclude<StoreKey, "site" | "tenCuaHang">, string | number | null>>;
export type RowIssue = { row: number; site?: string; column?: string; message: string };
export type PendingDate = {
  row: number;
  site: string;
  field: DateField;
  key: StoreKey;
  column: string;
  asIs: string | null;
  swapped: string | null;
  note: string;
};
export type ImportResult = {
  sheet: string;
  rows: ParsedStore[];
  /** Dòng bị bỏ qua */
  errors: RowIssue[];
  /** Dòng vẫn nhập nhưng có ô lỗi / cần lưu ý */
  warnings: RowIssue[];
  pending: PendingDate[];
  missingColumns: string[];
  unknownColumns: string[];
};

export function headerToKey(h: unknown): StoreKey | null {
  const n = normText(h);
  if (!n) return null;
  for (const [k, label] of COLUMNS) if (normText(label) === n) return k;
  for (const [k, , , alias] of COLUMNS) if (alias && n.startsWith(alias)) return k;
  return null;
}
const IGNORED_HEADERS = new Set(["tổng", "ngày cập nhật", "kiểm tra dữ liệu"]);

function cellValue(c: XLSX.CellObject | undefined): unknown {
  if (!c) return null;
  if (c.t === "z" || c.t === "e") return null;
  return c.v ?? null;
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array | Buffer): ImportResult {
  const wb = XLSX.read(data, { type: data instanceof ArrayBuffer ? "array" : "buffer", cellDates: false, cellNF: true });
  const sheetName = wb.SheetNames.find((n) => normText(n) === "tổng hợp");
  const res: ImportResult = {
    sheet: sheetName ?? wb.SheetNames[0] ?? "",
    rows: [], errors: [], warnings: [], pending: [], missingColumns: [], unknownColumns: [],
  };
  if (!sheetName) {
    res.errors.push({ row: 0, message: 'Không tìm thấy sheet "Tổng hợp"' });
    return res;
  }
  const ws = wb.Sheets[sheetName];
  if (!ws["!ref"]) {
    res.errors.push({ row: 0, message: "Sheet trống" });
    return res;
  }
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const at = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;

  // tìm dòng tiêu đề (chứa "Site")
  let hr = -1;
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 20) && hr < 0; r++)
    for (let c = range.s.c; c <= range.e.c; c++) if (normText(cellValue(at(r, c))) === "site") { hr = r; break; }
  if (hr < 0) {
    res.errors.push({ row: 0, message: 'Không tìm thấy dòng tiêu đề có cột "Site"' });
    return res;
  }
  const colKey = new Map<number, StoreKey>();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = cellValue(at(hr, c));
    const k = headerToKey(h);
    if (k && ![...colKey.values()].includes(k)) colKey.set(c, k);
    else if (normText(h) && !IGNORED_HEADERS.has(normText(h))) res.unknownColumns.push(String(h));
  }
  const present = new Set(colKey.values());
  res.missingColumns = COLUMNS.filter(([k]) => !present.has(k)).map(([, l]) => l);
  const missingReq = REQUIRED.filter((k) => !present.has(k));
  if (missingReq.length) {
    res.errors.push({ row: hr + 1, message: `Thiếu cột bắt buộc: ${missingReq.map((k) => COLUMNS.find((c) => c[0] === k)![1]).join(", ")}` });
    return res;
  }

  const seen = new Map<string, number>();
  for (let r = hr + 1; r <= range.e.r; r++) {
    const rowNo = r + 1; // số dòng như trong Excel
    const raw: Partial<Record<StoreKey, unknown>> = {};
    let empty = true;
    for (const [c, k] of colKey) {
      const v = cellValue(at(r, c));
      raw[k] = v;
      if (v !== null && String(v).trim() !== "") empty = false;
    }
    if (empty) continue;
    if (normText(raw.stt).startsWith("tổng")) continue; // dòng tổng cuối bảng

    const site = String(raw.site ?? "").trim().toUpperCase();
    const ten = String(raw.tenCuaHang ?? "").trim().replace(/\s+/g, " ");
    if (!site) { res.errors.push({ row: rowNo, message: "Thiếu mã Site — bỏ qua dòng" }); continue; }
    if (seen.has(site)) { res.errors.push({ row: rowNo, site, message: `Trùng mã Site với dòng ${seen.get(site)} — bỏ qua dòng` }); continue; }
    if (!ten) { res.errors.push({ row: rowNo, site, message: "Thiếu Tên cửa hàng — bỏ qua dòng" }); continue; }
    seen.set(site, rowNo);

    const out: Record<string, string | number | null> & { site: string; tenCuaHang: string } = { site, tenCuaHang: ten };
    const warn = (column: string, message: string) => res.warnings.push({ row: rowNo, site, column, message });

    for (const [k, label, kind] of COLUMNS) {
      if (k === "site" || k === "tenCuaHang" || !(k in raw)) continue;
      const v = raw[k];
      switch (kind) {
        case "date":
        case "month": {
          const p = parseDateCell(v, { monthOnly: kind === "month" });
          if (p.kind === "empty") out[k] = null;
          else if (p.kind === "ok") out[k] = p.iso;
          else if (p.kind === "error") { out[k] = null; warn(label, p.message); }
          else {
            out[k] = p.asIs; // giữ nguyên như file, không tự sửa
            const field = DATE_FIELD_MAP[k];
            if (field) res.pending.push({ row: rowNo, site, field, key: k, column: label, asIs: p.asIs, swapped: p.swapped, note: p.note });
          }
          break;
        }
        case "int":
        case "decimal":
        case "money": {
          if (v === null || String(v).trim() === "") { out[k] = null; break; }
          let n: number;
          if (typeof v === "number") n = v;
          else {
            const s = String(v).trim().replace(/\s/g, "");
            n = Number(kind === "decimal" ? s.replace(",", ".") : s.replace(/[.,](?=\d{3}(\D|$))/g, ""));
          }
          if (!Number.isFinite(n) || n < 0) { out[k] = null; warn(label, `Không phải số hợp lệ: “${v}”`); break; }
          if (kind === "int" || kind === "money") {
            if (!Number.isInteger(n)) warn(label, `Số lẻ “${v}” được làm tròn`);
            n = Math.round(n);
          }
          out[k] = n;
          break;
        }
        case "status": {
          const s = parseStatus(v);
          if (v !== null && String(v).trim() !== "" && !s) warn(label, `Trạng thái không hợp lệ “${v}” → đặt “Chưa cập nhật”`);
          out.trangThai = s ?? "CHUA_CAP_NHAT";
          break;
        }
        case "phone": {
          if (v === null || String(v).trim() === "") { out[k] = null; break; }
          let s = String(v).trim();
          if (typeof v === "number" && /^\d{9}$/.test(s)) s = "0" + s; // Excel mất số 0 đầu
          out[k] = s;
          break;
        }
        default: {
          const s = v === null ? "" : String(v).trim().replace(/\s+/g, " ");
          out[k] = s || null;
        }
      }
    }
    const vc = out.ngayVcDuKien as string | null | undefined, lap = out.ngayLapDuKien as string | null | undefined;
    if (vc && lap && lap < vc) warn("Ngày lắp - DỰ KIẾN", "Ngày lắp dự kiến trước ngày vận chuyển dự kiến (giữ nguyên)");
    res.rows.push(out as ParsedStore);
  }
  if (!res.rows.length && !res.errors.length) res.errors.push({ row: 0, message: "Không có dòng dữ liệu nào" });
  return res;
}
