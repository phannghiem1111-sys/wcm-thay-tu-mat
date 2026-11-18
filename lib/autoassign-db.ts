import { prisma } from "@/lib/db";
import { matchStoreIds } from "@/lib/autoassign";

/** Gán (chỉ thêm) cửa hàng cho các Đội trưởng KTKV đang hoạt động theo tên trong cột "Đội trưởng KTKV". Trả về số cửa hàng khớp mỗi người. */
export async function autoAssignDoiTruong(onlyUserId?: string): Promise<{ name: string; count: number }[]> {
  const [users, stores] = await Promise.all([
    prisma.user.findMany({ where: { role: "DOI_TRUONG", active: true, ...(onlyUserId ? { id: onlyUserId } : {}) } }),
    prisma.store.findMany({ select: { id: true, doiTruongKtkv: true } }),
  ]);
  const out: { name: string; count: number }[] = [];
  for (const u of users) {
    const ids = matchStoreIds(u.name, stores);
    if (ids.length) await prisma.storeAssignment.createMany({ data: ids.map((storeId) => ({ userId: u.id, storeId })), skipDuplicates: true });
    out.push({ name: u.name, count: ids.length });
  }
  return out;
}
