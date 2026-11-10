"use server";
import { redirect } from "next/navigation";
import { createSession, destroySession, verifyLogin } from "@/lib/auth";

export async function loginAction(_prev: { error?: string; email?: string } | undefined, fd: FormData) {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Nhập email và mật khẩu", email };
  const u = await verifyLogin(email, password);
  if (!u) return { error: "Email hoặc mật khẩu không đúng", email };
  await createSession(u.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
