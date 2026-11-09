// Phân quyền — mọi kiểm tra ở server gọi qua đây (không chỉ ẩn nút trên giao diện).
import type { Role } from "@prisma/client";

export type Actor = { id: string; role: Role };

export class ForbiddenError extends Error {
  constructor(msg = "Bạn không có quyền thực hiện thao tác này") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

export const can = {
  viewDashboard: (_u: Actor) => true,
  /** Người xem (GĐK, BGĐ khu vực) chỉ xem dashboard */
  viewStoreList: (u: Actor) => u.role !== "VIEWER",
  viewStoreDetail: (u: Actor) => u.role !== "VIEWER",
  importExcel: (u: Actor) => u.role === "ADMIN",
  exportExcel: (u: Actor) => u.role !== "VIEWER",
  manageUsers: (u: Actor) => u.role === "ADMIN",
  confirmDates: (u: Actor) => u.role === "ADMIN",
};

/** Trường được phép sửa theo vai trò */
export const EDITABLE_FIELDS: Record<Role, readonly string[] | "ALL"> = {
  ADMIN: "ALL",
  DOI_TRUONG: [
    "trangThai", "ngayVcDuKien", "ngayVcThucTe", "ngayLapDuKien", "ngayLapThucTe",
    "serialThucTe", "ktkv", "nhaThauLapDat", "nhaThauVanChuyen", "kmDenCh",
    "cht", "sdtCht", "hienTrangMayNen", "maTsXuatKho", "ghiChu", "linkHoSo", "photos",
  ],
  NHA_THAU: ["ngayVcThucTe", "ngayLapThucTe", "serialThucTe", "trangThai", "photos"],
  VIEWER: [],
};

export function canEditField(role: Role, field: string): boolean {
  const f = EDITABLE_FIELDS[role];
  return f === "ALL" ? true : f.includes(field);
}

/**
 * Đội trưởng và nhà thầu chỉ sửa được cửa hàng được gán (bảng StoreAssignment).
 * @param assignedStoreIds  id cửa hàng gán cho user (lấy từ DB ở server)
 */
export function canEditStore(u: Actor, storeId: string, assignedStoreIds: ReadonlySet<string>): boolean {
  if (u.role === "ADMIN") return true;
  if (u.role === "DOI_TRUONG" || u.role === "NHA_THAU") return assignedStoreIds.has(storeId);
  return false;
}

/** Ném ForbiddenError nếu user không được sửa cửa hàng / bất kỳ trường nào trong danh sách */
export function assertCanUpdate(u: Actor, storeId: string, assignedStoreIds: ReadonlySet<string>, fields: string[]): void {
  if (!canEditStore(u, storeId, assignedStoreIds)) throw new ForbiddenError("Cửa hàng không thuộc phạm vi được gán cho bạn");
  const bad = fields.filter((f) => !canEditField(u.role, f));
  if (bad.length) throw new ForbiddenError(`Không có quyền sửa: ${bad.join(", ")}`);
}

export function assertCan(ok: boolean, msg?: string): asserts ok {
  if (!ok) throw new ForbiddenError(msg);
}
