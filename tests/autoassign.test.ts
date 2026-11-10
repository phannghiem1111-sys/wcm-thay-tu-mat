import { describe, expect, it } from "vitest";
import { matchStoreIds, nameMatches } from "@/lib/autoassign";

describe("gán Đội trưởng theo tên", () => {
  it("bỏ dấu, hoa thường", () => { expect(nameMatches("TANG", "Tăng")).toBe(true); expect(nameMatches("Đạt", "dat")).toBe(true); });
  it("khớp từ cuối của họ tên đầy đủ", () => { expect(nameMatches("TANG", "Nguyễn Văn Tăng")).toBe(true); });
  it("không khớp tên khác / rỗng", () => { expect(nameMatches("TANG", "Tùng")).toBe(false); expect(nameMatches("TANG", null)).toBe(false); });
  it("lọc đúng cửa hàng", () => {
    expect(matchStoreIds("tang", [{ id: "1", doiTruongKtkv: "Tăng" }, { id: "2", doiTruongKtkv: "Hải" }, { id: "3", doiTruongKtkv: null }])).toEqual(["1"]);
  });
});
