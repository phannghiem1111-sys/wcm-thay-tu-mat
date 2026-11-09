"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction, hashPassword } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const RoleZ = z.enum(["ADMIN", "DOI_TRUONG", "NHA_THAU", "VIEWER"]);
type State = { error?: string; ok?: string } | undefined;

export async function createUser(_p: State, fd: FormData): Promise<State> {
  await requireAction(can.manageUsers);
  const r = z.object({
    email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
    name: z.string().trim().min(1, "Nhập họ tên"),
    password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
    role: RoleZ,
  }).safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  if (await prisma.user.findUnique({ where: { email: r.data.email } })) return { error: "Email đã tồn tại" };
  const u = await prisma.user.create({ data: { email: r.data.email, name: r.data.name, role: r.data.role, passwordHash: await hashPassword(r.data.password) } });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${u.id}`);
}

export async function updateUser(_p: State, fd: FormData): Promise<State> {
  const me = await requireAction(can.manageUsers);
  const r = z.object({
    id: z.string(),
    name: z.string().trim().min(1, "Nhập họ tên"),
    role: RoleZ,
    active: z.string().optional(),
    password: z.string().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  const { id, name, role, password } = r.data;
  const active = r.data.active === "on";
  if (id === me.id && (role !== "ADMIN" || !active)) return { error: "Không thể tự hạ quyền hoặc khoá chính mình" };
  if (password && password.length < 8) return { error: "Mật khẩu mới tối thiểu 8 ký tự" };
  await prisma.user.update({ where: { id }, data: { name, role, active, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
  revalidatePath("/admin/users");
  return { ok: "Đã lưu" };
}

export async function setAssignments(_p: State, fd: FormData): Promise<State> {
  await requireAction(can.manageUsers);
  const userId = String(fd.get("userId") ?? "");
  const storeIds = fd.getAll("storeId").map(String);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return { error: "Không thấy người dùng" };
  if (u.role !== "DOI_TRUONG" && u.role !== "NHA_THAU" && storeIds.length) return { error: "Chỉ gán cửa hàng cho Đội trưởng KTKV hoặc Nhà thầu" };
  await prisma.$transaction([
    prisma.storeAssignment.deleteMany({ where: { userId } }),
    prisma.storeAssignment.createMany({ data: storeIds.map((storeId) => ({ userId, storeId })), skipDuplicates: true }),
  ]);
  revalidatePath(`/admin/users/${userId}`);
  return { ok: `Đã gán ${storeIds.length} cửa hàng` };
}
