import { describe, expect, it } from "vitest";
import { assertCanUpdate, can, canEditField, canEditStore, ForbiddenError } from "@/lib/permissions";

const admin = { id: "a", role: "ADMIN" as const };
const dt = { id: "d", role: "DOI_TRUONG" as const };
const nt = { id: "n", role: "NHA_THAU" as const };
const viewer = { id: "v", role: "VIEWER" as const };
const mine = new Set(["s1"]);

describe("phân quyền", () => {
  it("chỉ Admin import, quản lý người dùng, xác nhận ngày", () => {
    for (const f of [can.importExcel, can.manageUsers, can.confirmDates]) {
      expect(f(admin)).toBe(true);
      expect(f(dt)).toBe(false);
      expect(f(nt)).toBe(false);
      expect(f(viewer)).toBe(false);
    }
  });
  it("Người xem chỉ xem dashboard", () => {
    expect(can.viewDashboard(viewer)).toBe(true);
    expect(can.viewStoreList(viewer)).toBe(false);
    expect(can.viewStoreDetail(viewer)).toBe(false);
    expect(can.viewStoreList(nt)).toBe(true);
  });
  it("Đội trưởng / Nhà thầu chỉ sửa cửa hàng được gán", () => {
    expect(canEditStore(dt, "s1", mine)).toBe(true);
    expect(canEditStore(dt, "s2", mine)).toBe(false);
    expect(canEditStore(nt, "s2", mine)).toBe(false);
    expect(canEditStore(admin, "s2", new Set())).toBe(true);
    expect(canEditStore(viewer, "s1", mine)).toBe(false);
  });
  it("Nhà thầu chỉ sửa ngày thực tế, serial (và trạng thái/ảnh)", () => {
    expect(canEditField("NHA_THAU", "ngayVcThucTe")).toBe(true);
    expect(canEditField("NHA_THAU", "serialThucTe")).toBe(true);
    expect(canEditField("NHA_THAU", "ngayLapDuKien")).toBe(false);
    expect(canEditField("NHA_THAU", "donGiaTaiSan")).toBe(false);
    expect(canEditField("DOI_TRUONG", "ngayLapDuKien")).toBe(true);
    expect(canEditField("DOI_TRUONG", "donGiaTaiSan")).toBe(false);
    expect(canEditField("VIEWER", "ghiChu")).toBe(false);
    expect(canEditField("ADMIN", "donGiaTaiSan")).toBe(true);
  });
  it("assertCanUpdate ném ForbiddenError", () => {
    expect(() => assertCanUpdate(nt, "s2", mine, ["serialThucTe"])).toThrow(ForbiddenError);
    expect(() => assertCanUpdate(nt, "s1", mine, ["donGiaTaiSan"])).toThrow(/donGiaTaiSan/);
    expect(() => assertCanUpdate(nt, "s1", mine, ["serialThucTe", "ngayLapThucTe"])).not.toThrow();
  });
});
