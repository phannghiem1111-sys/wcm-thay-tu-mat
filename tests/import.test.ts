import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import { parseWorkbook } from "@/lib/import/parse";
import { parseDateCell, formatVN } from "@/lib/dates";

const HEAD = ["Stt", "Phụ trách khu vực", "Tỉnh", "Tháng khai trương", "Site", "Tên cửa hàng", "SĐT CHT", "Đội trưởng KTKV", "Ngày VC - DỰ KIẾN", "Ngày lắp - DỰ KIẾN", "Trạng thái", "Số lượng", "Đơn giá tài sản (-VAT)", "Đơn giá V/C (-VAT)", "Đơn giá lắp đặt dự kiến", "Tổng"];

function book(rows: unknown[][], sheet = "Tổng hợp") {
  const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows], { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe("chuẩn hoá ngày", () => {
  it("chuỗi dd/mm/yyyy", () => {
    expect(parseDateCell("25/11/2026")).toEqual({ kind: "ok", iso: "2026-11-25" });
    expect(parseDateCell("05/11/2026")).toEqual({ kind: "ok", iso: "2026-11-05" });
    expect(parseDateCell("5-1-26")).toEqual({ kind: "ok", iso: "2026-01-05" });
  });
  it("chuỗi mm/dd không hợp lệ theo dd/mm => cần xác nhận, không tự sửa", () => {
    const p = parseDateCell("11/25/2026");
    expect(p).toMatchObject({ kind: "ambiguous", asIs: null, swapped: "2026-11-25" });
  });
  it("ô ngày thật có ngày ≤ 12 => nghi đảo; > 12 => chắc chắn", () => {
    expect(parseDateCell(46276)).toMatchObject({ kind: "ambiguous", asIs: "2026-09-11", swapped: "2026-11-09" }); // 11/09/2026
    expect(parseDateCell(46339)).toEqual({ kind: "ok", iso: "2026-11-13" });
    expect(parseDateCell(46337)).toEqual({ kind: "ok", iso: "2026-11-11" }); // ngày = tháng: không mơ hồ
  });
  it("tháng khai trương không bị coi là nghi đảo", () => {
    expect(parseDateCell(46174, { monthOnly: true })).toEqual({ kind: "ok", iso: "2026-06-01" });
  });
  it("ngày sai", () => {
    expect(parseDateCell("31/02/2026").kind).toBe("error");
    expect(parseDateCell("abc").kind).toBe("error");
  });
  it("hiển thị dd/mm/yyyy", () => expect(formatVN("2026-11-09")).toBe("09/11/2026"));
});

describe("import Excel", () => {
  it("đọc dòng hợp lệ, báo lỗi từng dòng, bỏ dòng tổng", () => {
    const buf = book([
      [1, "PT A", "T. Bắc Giang", d(2026, 6, 1), "2cfj", "CH 1", 988023976, "Thái", d(2026, 9, 11), d(2026, 11, 13), "Đang lắp", 1, 63000000, 1750000, 20000000, null],
      [2, "PT A", "T. Bắc Giang", null, "", "CH thiếu site", null, null, null, null, null, 1, 0, 0, 0, null],
      [3, "PT A", "T. Bắc Giang", null, "2CFJ", "CH trùng", null, null, null, null, null, 1, 0, 0, 0, null],
      [4, "PT B", "TP. Hà Nội", null, "2BVT", "CH 4", "0901 234 567", null, "25/11/2026", "11/30/2026", "Xong rồi", "abc", "63.000.000", 0, 0, null],
      ["TỔNG", null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, null],
    ]);
    const r = parseWorkbook(buf);
    expect(r.sheet).toBe("Tổng hợp");
    expect(r.rows.map((x) => x.site)).toEqual(["2CFJ", "2BVT"]);
    expect(r.errors).toEqual([
      expect.objectContaining({ row: 3, message: expect.stringContaining("Thiếu mã Site") }),
      expect.objectContaining({ row: 4, site: "2CFJ", message: expect.stringContaining("Trùng mã Site") }),
    ]);
    const a = r.rows[0];
    expect(a).toMatchObject({ tinh: "T. Bắc Giang", thangKhaiTruong: "2026-06-01", sdtCht: "0988023976", ngayVcDuKien: "2026-09-11", ngayLapDuKien: "2026-11-13", trangThai: "DANG_LAP", donGiaTaiSan: 63000000 });
    const b = r.rows[1];
    expect(b).toMatchObject({ ngayVcDuKien: "2026-11-25", ngayLapDuKien: null, trangThai: "CHUA_CAP_NHAT", soLuong: null, donGiaTaiSan: 63000000, sdtCht: "0901 234 567" });
    // ngày nghi đảo: giữ nguyên, đưa vào danh sách xác nhận
    expect(r.pending).toEqual([
      expect.objectContaining({ site: "2CFJ", field: "VC_DU_KIEN", asIs: "2026-09-11", swapped: "2026-11-09" }),
      expect.objectContaining({ site: "2BVT", field: "LAP_DU_KIEN", asIs: null, swapped: "2026-11-30" }),
    ]);
    expect(r.warnings.map((w) => `${w.site}|${w.column}`)).toEqual(expect.arrayContaining(["2BVT|Trạng thái", "2BVT|Số lượng"]));
  });
  it("không có sheet Tổng hợp => lỗi", () => {
    const r = parseWorkbook(book([], "Sheet1"));
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].message).toContain("Tổng hợp");
  });

  const real = "data/DS_Thay_tu_mat_WCM_tracking_final.xlsx";
  it.skipIf(!existsSync(real))("file thật: 47 cửa hàng, tổng 4.024.700.000 đ", () => {
    const r = parseWorkbook(readFileSync(real));
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(47);
    const total = r.rows.reduce((s, x) => s + Number(x.soLuong) * (Number(x.donGiaTaiSan) + Number(x.donGiaVanChuyen) + Number(x.donGiaLapDat)), 0);
    expect(total).toBe(4_024_700_000);
    expect(r.pending.length).toBeGreaterThan(0);
    expect(new Set(r.rows.map((x) => x.site)).size).toBe(47);
  });
});
