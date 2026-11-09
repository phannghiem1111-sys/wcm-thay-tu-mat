// Đồng bộ một chiều App → Google Sheets (nơi xem/sao lưu; dữ liệu chính vẫn ở app).
// Gọi Apps Script web app của Sheet (docs/google-sheets.gs). Không cấu hình => bỏ qua, app vẫn chạy.
import "server-only";
import { prisma } from "./db";
import { formatVN, toISODate } from "./dates";
import { STATUS_LABEL } from "./domain";

export const SHEET_HEADERS = [
  "Site", "Tên cửa hàng", "Tỉnh", "Trạng thái", "VC dự kiến", "VC thực tế", "Lắp dự kiến", "Lắp thực tế",
  "Serial thực tế", "Đội trưởng KTKV", "Nhà thầu lắp đặt", "Nhà thầu vận chuyển", "Ghi chú", "Số ảnh", "Link ảnh", "Link app", "Cập nhật lúc",
] as const;

export const sheetUrl = () => (process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}` : null);
export const sheetsEnabled = () => !!process.env.SHEETS_WEBHOOK_URL && !!process.env.SHEETS_WEBHOOK_SECRET;

type RowStore = {
  site: string; tenCuaHang: string; tinh: string | null; trangThai: keyof typeof STATUS_LABEL;
  ngayVcDuKien: Date | null; ngayVcThucTe: Date | null; ngayLapDuKien: Date | null; ngayLapThucTe: Date | null;
  serialThucTe: string | null; doiTruongKtkv: string | null; nhaThauLapDat: string | null; nhaThauVanChuyen: string | null;
  ghiChu: string | null; ngayCapNhat: Date; photos: { url: string }[];
};

export function toSheetRow(s: RowStore, appBase: string): string[] {
  return [
    s.site, s.tenCuaHang, s.tinh ?? "", STATUS_LABEL[s.trangThai],
    formatVN(toISODate(s.ngayVcDuKien)), formatVN(toISODate(s.ngayVcThucTe)), formatVN(toISODate(s.ngayLapDuKien)), formatVN(toISODate(s.ngayLapThucTe)),
    s.serialThucTe ?? "", s.doiTruongKtkv ?? "", s.nhaThauLapDat ?? "", s.nhaThauVanChuyen ?? "", s.ghiChu ?? "",
    String(s.photos.length), s.photos.map((p) => p.url).join("\n"),
    `${appBase}/stores/${encodeURIComponent(s.site)}`,
    s.ngayCapNhat.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
  ];
}

export type SyncResult = { ok: boolean; rows: number; error?: string };

/** ids rỗng/undefined = đồng bộ toàn bộ (ghi đè cả bảng). Lỗi không ném ra để không làm hỏng thao tác của người dùng. */
export async function syncToSheet(ids?: string[]): Promise<SyncResult> {
  if (!sheetsEnabled()) return { ok: false, rows: 0, error: "Chưa cấu hình Google Sheets" };
  try {
    const stores = await prisma.store.findMany({
      where: ids?.length ? { id: { in: ids } } : undefined,
      orderBy: { stt: "asc" },
      include: { photos: { select: { url: true }, orderBy: { createdAt: "asc" } } },
    });
    const base = (process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/$/, "");
    const res = await fetch(process.env.SHEETS_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: process.env.SHEETS_WEBHOOK_SECRET, mode: ids?.length ? "upsert" : "replace", headers: SHEET_HEADERS, rows: stores.map((s) => toSheetRow(s, base)) }),
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    let j: { ok?: boolean; error?: string } = {};
    try { j = JSON.parse(text); } catch {}
    if (!res.ok || !j.ok) return { ok: false, rows: 0, error: j.error ?? `Sheet trả về lỗi (${res.status})` };
    return { ok: true, rows: stores.length };
  } catch (e) {
    console.error("[sheets] sync lỗi", e);
    return { ok: false, rows: 0, error: e instanceof Error ? e.message : "Lỗi không rõ" };
  }
}
