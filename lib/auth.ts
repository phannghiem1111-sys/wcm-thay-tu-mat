// Đăng nhập email + mật khẩu, phiên lưu trong cookie JWT ký HS256 (httpOnly).
// Vai trò luôn đọc lại từ DB ở mỗi request => đổi quyền có hiệu lực ngay.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { ForbiddenError } from "./permissions";

export const SESSION_COOKIE = "wcm_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET chưa cấu hình (≥ 32 ký tự)");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}
export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type SessionUser = { id: string; email: string; name: string; role: Role };

/** Bỏ đăng nhập: không có phiên => dùng tài khoản Admin (ADMIN_EMAIL, hoặc Admin đầu tiên còn hoạt động). */
async function defaultUser(): Promise<SessionUser | null> {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const sel = { id: true, email: true, name: true, role: true } as const;
  const u =
    (email ? await prisma.user.findFirst({ where: { email, active: true }, select: sel }) : null) ??
    (await prisma.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" }, select: sel }));
  return u ? { id: u.id, email: u.email, name: u.name, role: u.role } : null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      const u = payload.sub ? await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, name: true, role: true, active: true } }) : null;
      if (u && u.active) return { id: u.id, email: u.email, name: u.name, role: u.role };
    } catch {}
  }
  return defaultUser();
}

/** Dùng trong page: chưa có tài khoản Admin nào => /login */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}
/** Dùng trong page: không đủ quyền => /forbidden */
export async function requirePage(check: (u: SessionUser) => boolean): Promise<SessionUser> {
  const u = await requireUser();
  if (!check(u)) redirect("/forbidden");
  return u;
}
/** Dùng trong server action / route handler: ném lỗi thay vì redirect */
export async function requireAction(check: (u: SessionUser) => boolean): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new ForbiddenError("Phiên đăng nhập đã hết, vui lòng đăng nhập lại");
  if (!check(u)) throw new ForbiddenError();
  return u;
}

let DUMMY_HASH: string | undefined;
export async function verifyLogin(email: string, password: string): Promise<SessionUser | null> {
  const u = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u || !u.active) {
    await bcrypt.compare(password, (DUMMY_HASH ??= bcrypt.hashSync("dummy-password", 10))); // cân bằng thời gian
    return null;
  }
  if (!(await bcrypt.compare(password, u.passwordHash))) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

/** Danh sách id cửa hàng được gán cho user (dùng cho canEditStore) */
export async function assignedStoreIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.storeAssignment.findMany({ where: { userId }, select: { storeId: true } });
  return new Set(rows.map((r) => r.storeId));
}
