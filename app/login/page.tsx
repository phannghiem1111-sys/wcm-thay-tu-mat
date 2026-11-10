import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

// Đã bỏ đăng nhập: vào thẳng trang chính. Form chỉ hiện khi DB chưa có tài khoản Admin nào.
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginForm />;
}
