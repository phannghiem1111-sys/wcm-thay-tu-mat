import { describe, expect, it } from "vitest";
import { planUpdate, type CurrentStore } from "@/lib/update";

const today = "2026-11-10";
const base: CurrentStore = { trangThai: "DANG_VAN_CHUYEN", ngayVcThucTe: "2026-11-05", ngayLapThucTe: null, serialThucTe: null, ghiChu: null };

describe("cập nhật tay cửa hàng", () => {
  it("không đổi gì thì không có thay đổi", () => {
    expect(planUpdate("ADMIN", base, { trangThai: "DANG_VAN_CHUYEN", serialThucTe: "" }, today).changes).toEqual({});
  });
  it("ghi nhận cũ → mới và chuẩn hoá chuỗi rỗng thành null", () => {
    const p = planUpdate("DOI_TRUONG", { ...base, ghiChu: "cũ" }, { ghiChu: " ", serialThucTe: " SN1 " }, today);
    expect(p.errors).toEqual([]);
    expect(p.changes.ghiChu).toEqual({ old: "cũ", new: null });
    expect(p.changes.serialThucTe).toEqual({ old: null, new: "SN1" });
  });
  it("chuyển Hoàn thành cần ngày lắp thực tế", () => {
    expect(planUpdate("ADMIN", base, { trangThai: "HOAN_THANH" }, today).errors).toContain("Cần ngày lắp đặt thực tế");
    expect(planUpdate("ADMIN", base, { trangThai: "HOAN_THANH", ngayLapThucTe: "2026-11-09" }, today).errors).toEqual([]);
  });
  it("chặn ngày tương lai, ngày sai và lắp trước vận chuyển", () => {
    expect(planUpdate("ADMIN", base, { ngayLapThucTe: "2026-12-01" }, today).errors).toContain("Ngày lắp thực tế không được ở tương lai");
    expect(planUpdate("ADMIN", base, { ngayLapThucTe: "2026-11-01" }, today).errors).toContain("Ngày lắp không được trước ngày vận chuyển");
    expect(planUpdate("ADMIN", base, { ngayVcThucTe: "2026-02-31" }, today).errors).toContain("Ngày vận chuyển thực tế không được ở tương lai".replace("không được ở tương lai", "không hợp lệ"));
  });
  it("trạng thái lạ bị từ chối; nghiệm thu cần đúng vai trò", () => {
    expect(planUpdate("ADMIN", base, { trangThai: "XYZ" }, today).errors).toContain("Trạng thái không hợp lệ");
    const done: CurrentStore = { ...base, trangThai: "HOAN_THANH", ngayLapThucTe: "2026-11-09" };
    expect(planUpdate("NHA_THAU", done, { trangThai: "DA_NGHIEM_THU" }, today).errors.length).toBeGreaterThan(0);
    expect(planUpdate("DOI_TRUONG", done, { trangThai: "DA_NGHIEM_THU" }, today).errors).toEqual([]);
  });
  it("sửa ghi chú của cửa hàng cũ thiếu ngày không bị chặn", () => {
    const legacy: CurrentStore = { ...base, trangThai: "HOAN_THANH", ngayVcThucTe: null };
    expect(planUpdate("ADMIN", legacy, { ghiChu: "ok" }, today).errors).toEqual([]);
  });
});
