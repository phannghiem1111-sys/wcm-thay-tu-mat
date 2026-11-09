import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { SHEET_HEADERS, toSheetRow } from "@/lib/sheets";

describe("dòng Google Sheets", () => {
  it("số cột khớp tiêu đề, ngày dd/mm/yyyy, link ảnh nối dòng", () => {
    const row = toSheetRow(
      {
        site: "2CFJ", tenCuaHang: "WM+ A", tinh: "T. Bắc Giang", trangThai: "DANG_LAP",
        ngayVcDuKien: new Date("2026-09-11T00:00:00Z"), ngayVcThucTe: null, ngayLapDuKien: new Date("2026-10-11T00:00:00Z"), ngayLapThucTe: null,
        serialThucTe: "SN1", doiTruongKtkv: "Thái", nhaThauLapDat: null, nhaThauVanChuyen: null, ghiChu: null,
        ngayCapNhat: new Date("2026-11-09T10:00:00Z"), photos: [{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }],
      },
      "https://app.test",
    );
    expect(row).toHaveLength(SHEET_HEADERS.length);
    expect(row[3]).toBe("Đang lắp");
    expect(row[4]).toBe("11/09/2026");
    expect(row[5]).toBe("");
    expect(row[13]).toBe("2");
    expect(row[14]).toBe("https://x/a.jpg\nhttps://x/b.jpg");
    expect(row[15]).toBe("https://app.test/stores/2CFJ");
  });
});
