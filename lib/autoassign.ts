// Gán nhanh cửa hàng cho Đội trưởng KTKV theo tên trong cột "Đội trưởng KTKV" (thuần, có test).
const fold = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();

/** Tên tài khoản khớp tên trong dữ liệu: bỏ dấu/hoa thường; hoặc trùng từ cuối (vd "TANG" với "Nguyễn Văn Tăng"). */
export function nameMatches(userName: string, dataName: string | null | undefined): boolean {
  const u = fold(userName), d = fold(dataName);
  if (!u || !d) return false;
  return u === d || d.split(" ").pop() === u;
}

export function matchStoreIds(userName: string, stores: { id: string; doiTruongKtkv: string | null }[]): string[] {
  return stores.filter((s) => nameMatches(userName, s.doiTruongKtkv)).map((s) => s.id);
}
