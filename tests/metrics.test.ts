import { describe, expect, it } from "vitest";
import { computeDashboard, percent, storeTotal, type DashStore } from "@/lib/domain";

describe("tính %", () => {
  it("làm tròn 1 chữ số, mẫu 0 => 0", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(2, 3)).toBe(66.7);
    expect(percent(47, 47)).toBe(100);
    expect(percent(5, 47)).toBe(10.6);
  });
  it("Tổng = SL × (3 đơn giá)", () => {
    expect(storeTotal({ soLuong: 1, donGiaTaiSan: 63_000_000, donGiaVanChuyen: 1_750_000, donGiaLapDat: 20_000_000 })).toBe(84_750_000);
    expect(storeTotal({ soLuong: 2, donGiaTaiSan: 10, donGiaVanChuyen: 0, donGiaLapDat: 5 })).toBe(30);
  });
});

describe("dashboard", () => {
  const today = "2026-11-09";
  const mk = (site: string, trangThai: DashStore["trangThai"], ngayLapDuKien: string | null, tinh = "Hà Nội", dt: string | null = "Huy"): DashStore =>
    ({ site, trangThai, ngayLapDuKien, tinh, doiTruongKtkv: dt, phuTrachKhuVuc: "PT", total: 100 });
  const stores = [
    mk("A", "HOAN_THANH", "2026-11-01"),
    mk("B", "DA_NGHIEM_THU", "2026-11-01"),
    mk("C", "DANG_LAP", "2026-11-01", "Bắc Ninh"), // trễ
    mk("D", "CHUA_CAP_NHAT", "2026-12-01", "Bắc Ninh", null),
  ];
  const d = computeDashboard(stores, today);
  it("đếm hoàn thành gồm đã nghiệm thu, tỷ lệ", () => {
    expect(d.total).toBe(4);
    expect(d.done).toBe(2);
    expect(d.donePct).toBe(50);
  });
  it("đếm trễ", () => {
    expect(d.late).toBe(1);
    expect(d.lateSites).toEqual(["C"]);
  });
  it("đếm theo trạng thái đủ 7 nhóm, tổng = số CH", () => {
    expect(d.byStatus).toHaveLength(7);
    expect(d.byStatus.reduce((a, b) => a + b.count, 0)).toBe(4);
  });
  it("nhóm theo tỉnh / đội trưởng (kể cả chưa có)", () => {
    expect(d.byTinh.find((g) => g.key === "Bắc Ninh")).toMatchObject({ total: 2, done: 0, late: 1, pct: 0 });
    expect(d.byTinh.find((g) => g.key === "Hà Nội")).toMatchObject({ total: 2, done: 2, pct: 100 });
    expect(d.byDoiTruong.find((g) => g.key === "(Chưa có)")?.total).toBe(1);
  });
  it("giá trị", () => {
    expect(d.value).toBe(400);
    expect(d.valueDone).toBe(200);
  });
});
