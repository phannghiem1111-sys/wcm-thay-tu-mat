"use server";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";

type State = { error?: string; ok?: string } | undefined;
const RESET_PHRASE = "XOA HET";

/** Xoá toàn bộ dữ liệu đã nạp: cửa hàng, tiến độ, ảnh, lịch sử, ngày chờ xác nhận và mọi tài khoản trừ Admin đang thao tác. Giữ nguyên cấu trúc DB. */
export async function resetAllData(_p: State, fd: FormData): Promise<State> {
  const me = await requireAction(can.manageUsers);
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== RESET_PHRASE) return { error: `Gõ đúng "${RESET_PHRASE}" để xác nhận` };

  const photos = await prisma.photo.findMany({ select: { url: true } });
  const n = await prisma.$transaction(async (tx) => ({
    photos: (await tx.photo.deleteMany()).count,
    logs: (await tx.auditLog.deleteMany()).count,
    dates: (await tx.dateConfirmation.deleteMany()).count,
    assigns: (await tx.storeAssignment.deleteMany()).count,
    stores: (await tx.store.deleteMany()).count,
    users: (await tx.user.deleteMany({ where: { id: { not: me.id } } })).count,
  }));
  let blobFail = 0;
  if (process.env.BLOB_READ_WRITE_TOKEN && photos.length) {
    for (let i = 0; i < photos.length; i += 100) {
      await del(photos.slice(i, i + 100).map((p) => p.url)).catch(() => { blobFail += Math.min(100, photos.length - i); });
    }
  }
  revalidatePath("/", "layout");
  return { ok: `Đã xoá ${n.stores} cửa hàng, ${n.photos} ảnh${blobFail ? ` (${blobFail} file ảnh chưa xoá được trên kho)` : ""}, ${n.logs} dòng lịch sử, ${n.dates} ngày chờ xác nhận, ${n.assigns} phân công, ${n.users} tài khoản. Giữ lại tài khoản của bạn.` };
}
