"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncToSheet } from "@/lib/sheets";
import type { Prisma } from "@prisma/client";
import { assignedStoreIds, requireAction } from "@/lib/auth";
import { assertCanUpdate, can, ForbiddenError } from "@/lib/permissions";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { fromISODate, toISODate, todayVN } from "@/lib/dates";
import { normText, STATUS_LABEL, STATUS_ORDER } from "@/lib/domain";
import { planUpdate, type UpdateInput } from "@/lib/update";

export type UpdateResult = { ok: true; message: string } | { ok: false; errors: string[] };

const CONFIRM_FIELD = { ngayVcThucTe: "VC_THUC_TE", ngayLapThucTe: "LAP_THUC_TE" } as const;

export async function updateStore(site: string, input: UpdateInput): Promise<UpdateResult> {
  try {
    const u = await requireAction(can.viewStoreDetail);
    const store = await prisma.store.findUnique({ where: { site } });
    if (!store) return { ok: false, errors: ["Không tìm thấy cửa hàng"] };

    const plan = planUpdate(
      u.role,
      { trangThai: store.trangThai, ngayVcThucTe: toISODate(store.ngayVcThucTe), ngayLapThucTe: toISODate(store.ngayLapThucTe), serialThucTe: store.serialThucTe, ghiChu: store.ghiChu },
      input,
      todayVN(),
    );
    const fields = Object.keys(plan.changes);
    if (!plan.errors.length && !fields.length) return { ok: false, errors: ["Không có thay đổi nào để lưu"] };
    // phân quyền kiểm tra ở server: đúng cửa hàng được gán + đúng trường được phép sửa
    assertCanUpdate(u, store.id, await assignedStoreIds(u.id), fields);
    if (plan.errors.length) return { ok: false, errors: plan.errors };

    const c = plan.changes;
    if (c.serialThucTe?.new) {
      const dup = await prisma.store.findMany({ where: { serialThucTe: { not: null }, NOT: { id: store.id } }, select: { site: true, serialThucTe: true } });
      const hit = dup.find((d) => normText(d.serialThucTe) === normText(c.serialThucTe!.new));
      if (hit) return { ok: false, errors: [`Serial đã dùng ở cửa hàng ${hit.site}`] };
    }

    const data: Prisma.StoreUpdateInput = {};
    if (c.trangThai) data.trangThai = c.trangThai.new as never;
    if (c.ngayVcThucTe) data.ngayVcThucTe = fromISODate(c.ngayVcThucTe.new);
    if (c.ngayLapThucTe) data.ngayLapThucTe = fromISODate(c.ngayLapThucTe.new);
    if (c.serialThucTe) data.serialThucTe = c.serialThucTe.new;
    if (c.ghiChu) data.ghiChu = c.ghiChu.new;

    const changes = Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, k === "trangThai" ? { old: v!.old && STATUS_LABEL[v!.old as keyof typeof STATUS_LABEL], new: v!.new && STATUS_LABEL[v!.new as keyof typeof STATUS_LABEL] } : v]),
    );
    await prisma.$transaction(async (tx) => {
      await tx.store.update({ where: { id: store.id }, data });
      // nhập tay ngày thực tế thì không còn gì phải xác nhận cho ngày đó
      const done = (["ngayVcThucTe", "ngayLapThucTe"] as const).filter((k) => c[k]).map((k) => CONFIRM_FIELD[k]);
      if (done.length) await tx.dateConfirmation.updateMany({ where: { storeId: store.id, field: { in: done }, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedById: u.id } });
      await tx.auditLog.create({ data: { storeId: store.id, userId: u.id, action: "Cập nhật tay", changes: changes as Prisma.InputJsonValue } });
    });
    revalidatePath("/", "layout");
    after(() => syncToSheet([store.id]));
    return { ok: true, message: "Đã lưu cập nhật" };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, errors: [e.message] };
    throw e;
  }
}

export async function deletePhoto(id: string): Promise<UpdateResult> {
  try {
    const u = await requireAction(can.viewStoreDetail);
    const ph = await prisma.photo.findUnique({ where: { id }, include: { store: { select: { id: true } } } });
    if (!ph) return { ok: false, errors: ["Không tìm thấy ảnh"] };
    assertCanUpdate(u, ph.store.id, await assignedStoreIds(u.id), ["photos"]);
    if (u.role !== "ADMIN" && ph.uploadedBy !== u.id) return { ok: false, errors: ["Chỉ xoá được ảnh do chính bạn tải lên"] };
    await prisma.$transaction([
      prisma.photo.delete({ where: { id } }),
      prisma.auditLog.create({ data: { storeId: ph.store.id, userId: u.id, action: "Xoá ảnh hiện trường" } }),
    ]);
    if (process.env.BLOB_READ_WRITE_TOKEN) await del(ph.url).catch(() => {});
    revalidatePath("/", "layout");
    after(() => syncToSheet([ph.store.id]));
    return { ok: true, message: "Đã xoá ảnh" };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, errors: [e.message] };
    throw e;
  }
}

/** Admin: đẩy toàn bộ dữ liệu sang Google Sheets ngay */
export async function syncAllNow(): Promise<UpdateResult> {
  await requireAction(can.importExcel);
  const r = await syncToSheet();
  return r.ok ? { ok: true, message: `Đã đồng bộ ${r.rows} cửa hàng sang Google Sheets` } : { ok: false, errors: [r.error ?? "Đồng bộ lỗi"] };
}

/**
 * Chọn nhanh trạng thái từ nhãn trong danh sách/dashboard.
 * Tự điền ngày thực tế = hôm nay nếu bước đó cần mà chưa có (sửa lại sau trong trang chi tiết).
 * Vẫn đi qua updateStore: cùng kiểm tra quyền, nghiệp vụ và audit log.
 */
export async function quickStatus(site: string, status: string): Promise<UpdateResult> {
  const u = await requireAction(can.viewStoreDetail);
  const s = await prisma.store.findUnique({ where: { site }, select: { ngayVcThucTe: true, ngayLapThucTe: true } });
  if (!s) return { ok: false, errors: ["Không tìm thấy cửa hàng"] };
  const idx = STATUS_ORDER.indexOf(status as never);
  const today = todayVN();
  const input: UpdateInput = { trangThai: status };
  if (idx >= STATUS_ORDER.indexOf("DA_DEN_CH") && !s.ngayVcThucTe) input.ngayVcThucTe = today;
  if (idx >= STATUS_ORDER.indexOf("HOAN_THANH") && !s.ngayLapThucTe) input.ngayLapThucTe = today;
  void u;
  return updateStore(site, input);
}
