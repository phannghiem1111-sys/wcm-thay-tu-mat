import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { after } from "next/server";
import { assignedStoreIds, getCurrentUser } from "@/lib/auth";
import { assertCanUpdate, can, ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { syncToSheet } from "@/lib/sheets";

export const maxDuration = 60;
const MAX_PER_STORE = 10;
const MAX_BYTES = 4 * 1024 * 1024; // ảnh đã nén ở trình duyệt, thường < 500KB

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!u || !can.viewStoreDetail(u)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Chưa cấu hình kho ảnh (BLOB_READ_WRITE_TOKEN)" }, { status: 501 });

  const fd = await req.formData();
  const site = String(fd.get("site") ?? "");
  const file = fd.get("file");
  if (!(file instanceof File) || !site) return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Chỉ nhận file ảnh" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Ảnh quá lớn (tối đa 4MB sau khi nén)" }, { status: 413 });

  const store = await prisma.store.findUnique({ where: { site }, select: { id: true, _count: { select: { photos: true } } } });
  if (!store) return NextResponse.json({ error: "Không tìm thấy cửa hàng" }, { status: 404 });
  try {
    assertCanUpdate(u, store.id, await assignedStoreIds(u.id), ["photos"]);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  if (store._count.photos >= MAX_PER_STORE) return NextResponse.json({ error: `Tối đa ${MAX_PER_STORE} ảnh mỗi cửa hàng` }, { status: 409 });

  const key = `stores/${site}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const blob = await put(key, file, { access: "public", contentType: "image/jpeg", addRandomSuffix: false });
  const photo = await prisma.$transaction(async (tx) => {
    const p = await tx.photo.create({ data: { storeId: store.id, key, url: blob.url, sizeBytes: file.size, uploadedBy: u.id } });
    await tx.auditLog.create({ data: { storeId: store.id, userId: u.id, action: "Thêm ảnh hiện trường" } });
    return p;
  });
  after(() => syncToSheet([store.id]));
  return NextResponse.json({ ok: true, id: photo.id, url: photo.url });
}
