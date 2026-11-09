"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { assignedStoreIds, requireAction } from "@/lib/auth";
import { assertCanUpdate, can, ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { fromISODate, toISODate, todayVN } from "@/lib/dates";
import { normText, STATUS_LABEL } from "@/lib/domain";
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
    return { ok: true, message: "Đã lưu cập nhật" };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, errors: [e.message] };
    throw e;
  }
}
