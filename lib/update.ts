// Cập nhật tay một cửa hàng: chuẩn hoá đầu vào, kiểm tra nghiệp vụ, tính phần thay đổi (thuần, có test).
import type { Role, StoreStatus } from "@prisma/client";
import { isValidYMD } from "./dates";
import { STATUS_ORDER, validateStatusUpdate, type ISODate } from "./domain";

export const UPDATE_FIELDS = ["trangThai", "ngayVcThucTe", "ngayLapThucTe", "serialThucTe", "ghiChu"] as const;
export type UpdateField = (typeof UPDATE_FIELDS)[number];
/** Chỉ các khoá có mặt mới được xem là muốn sửa; chuỗi rỗng = xoá giá trị */
export type UpdateInput = Partial<Record<UpdateField, string | null>>;
export type CurrentStore = {
  trangThai: StoreStatus;
  ngayVcThucTe: ISODate;
  ngayLapThucTe: ISODate;
  serialThucTe: string | null;
  ghiChu: string | null;
};
export type Change = { old: string | null; new: string | null };
export type UpdatePlan = { errors: string[]; changes: Partial<Record<UpdateField, Change>> };

const DATE_LABEL = { ngayVcThucTe: "Ngày vận chuyển thực tế", ngayLapThucTe: "Ngày lắp thực tế" } as const;

export function planUpdate(role: Role, current: CurrentStore, input: UpdateInput, today: string): UpdatePlan {
  const errors: string[] = [];
  const next: Record<UpdateField, string | null> = { ...current };
  const changes: UpdatePlan["changes"] = {};

  for (const f of UPDATE_FIELDS) {
    if (!(f in input)) continue;
    const raw = input[f];
    let v: string | null = raw === null || raw === undefined ? null : String(raw).trim();
    if (v === "") v = null;
    if (f === "trangThai") {
      if (!v || !STATUS_ORDER.includes(v as StoreStatus)) { errors.push("Trạng thái không hợp lệ"); continue; }
    } else if (f === "ngayVcThucTe" || f === "ngayLapThucTe") {
      if (v) {
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m || !isValidYMD(+m[1], +m[2], +m[3])) { errors.push(`${DATE_LABEL[f]} không hợp lệ`); continue; }
      }
    } else if (f === "serialThucTe") {
      if (v && v.length > 60) { errors.push("Serial quá dài (tối đa 60 ký tự)"); continue; }
    } else if (f === "ghiChu") {
      if (v && v.length > 1000) { errors.push("Ghi chú quá dài (tối đa 1000 ký tự)"); continue; }
    }
    if ((current[f] ?? null) !== v) {
      changes[f] = { old: current[f] ?? null, new: v };
      next[f] = v;
    }
  }

  if (!errors.length && Object.keys(changes).length) {
    const to = next.trangThai as StoreStatus;
    if (changes.trangThai) {
      errors.push(...validateStatusUpdate({ role, from: current.trangThai, to, ngayVcThucTe: next.ngayVcThucTe, ngayLapThucTe: next.ngayLapThucTe, today }));
    } else {
      if (next.ngayVcThucTe && next.ngayVcThucTe > today) errors.push("Ngày vận chuyển thực tế không được ở tương lai");
      if (next.ngayLapThucTe && next.ngayLapThucTe > today) errors.push("Ngày lắp thực tế không được ở tương lai");
      if (next.ngayVcThucTe && next.ngayLapThucTe && next.ngayLapThucTe < next.ngayVcThucTe) errors.push("Ngày lắp không được trước ngày vận chuyển");
    }
  }
  return { errors: [...new Set(errors)], changes };
}
