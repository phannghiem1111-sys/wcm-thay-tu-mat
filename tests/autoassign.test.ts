import { describe, expect, it } from "vitest";
import { matchStoreIds, nameMatches } from "@/lib/autoassign";

describe("gán Đội trưởng theo tên", () => {
  it("bỏ dấu, hoa thường", () => { expect(nameMatches("TANG", "Tăng")).toBe(true); expect(nameMatches("Đạt", "dat")).toBe(true); });
  it("khớp từ cuối của họ tên đầy đủ", () => { expect(nameMatches("TANG", "Nguyễn Văn Tăng")).toBe(true); });
  it("bỏ số điện thoại trong dữ liệu", () => {
    expect(nameMatches("THAI", "Thái 0936425991")).toBe(true);
    expect(nameMatches("Huy", "Huy 0976284386")).toBe(true);
    expect(nameMatches("THIEN", "Thiện 0962361109")).toBe(true);
    expect(nameMatches("TANG", "Tăng 0333247075")).toBe(true);
    expect(nameMatches("THAI", "Huy 0976284386")).toBe(false);
  });
  it("không khớp tên khác / rỗng", () => { expect(nameMatches("TANG", "Tùng")).toBe(false); expect(nameMatches("TANG", null)).toBe(false); });
  it("lọc đúng cửa hàng", () => {
    expect(matchStoreIds("tang", [{ id: "1", doiTruongKtkv: "Tăng" }, { id: "2", doiTruongKtkv: "Hải" }, { id: "3", doiTruongKtkv: null }])).toEqual(["1"]);
  });
});
