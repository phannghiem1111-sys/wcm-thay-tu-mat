"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <main>
      <form action={action} className="login card">
        <h2>Theo dõi thay tủ mát WCM</h2>
        {state?.error && <div className="err">{state.error}</div>}
        <label className="f">Email<input name="email" type="email" autoComplete="username" required defaultValue={state?.email} key={state?.email} /></label>
        <label className="f">Mật khẩu<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn pri big" disabled={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        <p className="small muted" style={{ textAlign: "center" }}>Chưa có tài khoản? Liên hệ trưởng phòng KT.</p>
      </form>
    </main>
  );
}
