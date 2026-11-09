import { describe, expect, it } from "vitest";
import { isDone, isLate, parseStatus, STATUS_ORDER, statusIndex, validateStatusUpdate, dataFlags, findDuplicateSerials } from "@/lib/domain";

const today = "2026-11-09";

describe("trạng thái", () => {
  it("thứ tự 7 trạng thái đúng như đặc tả", () => {
    expect(STATUS_ORDER).toEqual(["CHUA_CAP_NHAT", "CHUA_XUAT_KHO", "DANG_VAN_CHUYEN", "DA_DEN_CH", "DANG_LAP", "HOAN_THANH", "DA_NGHIEM_THU"]);
    expect(statusIndex("DA_DEN_CH")).toBe(3);
  });
  it("đọc nhãn tiếng Việt, không phân biệt hoa thường/khoảng trắng", () => {
    expect(parseStatus("Đã nghiệm thu")).toBe("DA_NGHIEM_THU");
    expect(parseStatus("  đã  đến ch ")).toBe("DA_DEN_CH");
    expect(parseStatus("Xong")).toBeNull();
    expect(parseStatus("")).toBeNull();
  });
  it("hoàn thành gồm cả đã nghiệm thu", () => {
    expect(isDone("HOAN_THANH")).toBe(true);
    expect(isDone("DA_NGHIEM_THU")).toBe(true);
    expect(isDone("DANG_LAP")).toBe(false);
  });
  it("trễ = ngày lắp DK đã qua và chưa hoàn thành", () => {
    expect(isLate({ trangThai: "DANG_LAP", ngayLapDuKien: "2026-11-08" }, today)).toBe(true);
    expect(isLate({ trangThai: "DANG_LAP", ngayLapDuKien: today }, today)).toBe(false); // hôm nay chưa tính trễ
    expect(isLate({ trangThai: "HOAN_THANH", ngayLapDuKien: "2026-10-01" }, today)).toBe(false);
    expect(isLate({ trangThai: "DA_NGHIEM_THU", ngayLapDuKien: "2026-10-01" }, today)).toBe(false);
    expect(isLate({ trangThai: "CHUA_CAP_NHAT", ngayLapDuKien: null }, today)).toBe(false);
  });
});

describe("kiểm tra cập nhật trạng thái", () => {
  const base = { role: "DOI_TRUONG" as const, from: "DANG_LAP" as const, ngayVcThucTe: "2026-11-01", ngayLapThucTe: "2026-11-05", today };
  it("hợp lệ khi đủ ngày", () => expect(validateStatusUpdate({ ...base, to: "HOAN_THANH" })).toEqual([]));
  it("hoàn thành cần ngày lắp thực tế", () => expect(validateStatusUpdate({ ...base, to: "HOAN_THANH", ngayLapThucTe: null })).toContain("Cần ngày lắp đặt thực tế"));
  it("đã đến CH cần ngày VC thực tế", () => expect(validateStatusUpdate({ ...base, to: "DA_DEN_CH", ngayVcThucTe: null, ngayLapThucTe: null })).toContain("Cần ngày vận chuyển thực tế"));
  it("nhà thầu không được nghiệm thu", () => expect(validateStatusUpdate({ ...base, role: "NHA_THAU", from: "HOAN_THANH", to: "DA_NGHIEM_THU" })).toContain("Chỉ Admin hoặc Đội trưởng KTKV được xác nhận nghiệm thu"));
  it("phải hoàn thành trước khi nghiệm thu", () => expect(validateStatusUpdate({ ...base, role: "ADMIN", from: "DANG_LAP", to: "DA_NGHIEM_THU" })).toContain("Phải Hoàn thành trước khi Nghiệm thu"));
  it("ngày thực tế không ở tương lai, lắp không trước VC", () => {
    const e = validateStatusUpdate({ ...base, to: "HOAN_THANH", ngayVcThucTe: "2026-11-20", ngayLapThucTe: "2026-11-02" });
    expect(e).toContain("Ngày vận chuyển thực tế không được ở tương lai");
    expect(e).toContain("Ngày lắp không được trước ngày vận chuyển");
  });
});

describe("cờ lỗi dữ liệu", () => {
  const s = { site: "A", trangThai: "HOAN_THANH" as const, doiTruongKtkv: "Thái", nhaThauLapDat: "X", nhaThauVanChuyen: null, sdtCht: "09", ngayVcDuKien: "2026-12-11", ngayVcThucTe: null, ngayLapDuKien: "2026-11-13", ngayLapThucTe: null, serialThucTe: null, pendingDates: 2 };
  it("phát hiện đủ các lỗi", () => {
    const f = dataFlags(s, today);
    expect(f).toEqual(expect.arrayContaining(["Ngày chờ xác nhận (nghi đảo ngày/tháng)", "Thiếu NT vận chuyển", "Ngày lắp DK trước ngày VC DK", "Hoàn thành nhưng thiếu ngày lắp thực tế", "Hoàn thành nhưng thiếu serial thực tế", "Đã đến CH nhưng thiếu ngày VC thực tế"]));
  });
  it("serial trùng", () => {
    const dup = findDuplicateSerials([{ serialThucTe: "sn1" }, { serialThucTe: "SN1 " }, { serialThucTe: "sn2" }, { serialThucTe: null }]);
    expect([...dup]).toEqual(["sn1"]);
  });
});
