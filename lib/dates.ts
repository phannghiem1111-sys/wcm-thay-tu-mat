// Chuẩn hoá ngày: lưu DATE (yyyy-mm-dd), hiển thị dd/mm/yyyy.
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function isValidYMD(y: number, m: number, d: number): boolean {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1)) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Hôm nay theo giờ Việt Nam, yyyy-mm-dd */
export function todayVN(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

/** Date (cột @db.Date, UTC 00:00) -> yyyy-mm-dd */
export const toISODate = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
/** yyyy-mm-dd -> Date UTC 00:00 để ghi Prisma */
export const fromISODate = (s: string | null | undefined): Date | null => (s ? new Date(`${s}T00:00:00.000Z`) : null);

export function formatVN(iso: string | Date | null | undefined): string {
  const s = iso instanceof Date ? toISODate(iso) : iso;
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
export function formatMonthVN(iso: string | Date | null | undefined): string {
  const s = iso instanceof Date ? toISODate(iso) : iso;
  if (!s) return "";
  const [y, m] = s.split("-");
  return `${m}/${y}`;
}

/** Excel serial (hệ 1900) -> {y,m,d} */
export function excelSerialToYMD(serial: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const ms = Math.round((Math.floor(serial) - 25569) * 86400000); // 25569 = 1970-01-01
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export type ParsedDate =
  | { kind: "empty" }
  | { kind: "ok"; iso: string }
  /** Nghi đảo ngày/tháng: giữ iso như file (asIs, có thể null nếu không hợp lệ), cần xác nhận */
  | { kind: "ambiguous"; asIs: string | null; swapped: string | null; note: string }
  | { kind: "error"; message: string };

/**
 * Đọc ô ngày từ Excel.
 * - Ô kiểu ngày (số serial / Date): nếu ngày ≤ 12 và khác tháng => nghi đảo, KHÔNG tự sửa.
 * - Chuỗi dd/mm/yyyy: đọc theo ngày/tháng. Nếu phần tháng > 12 mà đảo lại hợp lệ => nghi đảo.
 * - Chuỗi yyyy-mm-dd: chấp nhận.
 */
export function parseDateCell(v: unknown, opts: { monthOnly?: boolean } = {}): ParsedDate {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return { kind: "empty" };
  let parts: { y: number; m: number; d: number } | null = null;
  if (v instanceof Date && !isNaN(v.getTime())) parts = { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate() };
  else if (typeof v === "number") parts = excelSerialToYMD(v);
  if (parts) {
    const { y, m, d } = parts;
    if (!isValidYMD(y, m, d)) return { kind: "error", message: `Ngày không hợp lệ (${v})` };
    const iso = ymd(y, m, d);
    if (!opts.monthOnly && d <= 12 && d !== m) {
      return { kind: "ambiguous", asIs: iso, swapped: ymd(y, d, m), note: "Ô kiểu ngày có ngày ≤ 12, có thể bị đảo ngày/tháng" };
    }
    return { kind: "ok", iso };
  }
  const s = String(v).trim();
  let mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (mt) {
    const [y, m, d] = [+mt[1], +mt[2], +mt[3]];
    return isValidYMD(y, m, d) ? { kind: "ok", iso: ymd(y, m, d) } : { kind: "error", message: `Ngày không hợp lệ: ${s}` };
  }
  mt = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (mt) {
    const a = +mt[1], b = +mt[2];
    let y = +mt[3];
    if (y < 100) y += 2000;
    if (isValidYMD(y, b, a)) return { kind: "ok", iso: ymd(y, b, a) }; // dd/mm/yyyy
    if (isValidYMD(y, a, b)) return { kind: "ambiguous", asIs: null, swapped: ymd(y, a, b), note: `“${s}” không hợp lệ theo dd/mm/yyyy, có thể là mm/dd/yyyy` };
    return { kind: "error", message: `Ngày không hợp lệ: ${s}` };
  }
  if (opts.monthOnly) {
    mt = s.match(/^(\d{1,2})[/.\-](\d{4})$/);
    if (mt && +mt[1] >= 1 && +mt[1] <= 12) return { kind: "ok", iso: ymd(+mt[2], +mt[1], 1) };
  }
  return { kind: "error", message: `Không đọc được ngày: ${s}` };
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
