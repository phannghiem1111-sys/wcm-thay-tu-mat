import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/domain";
import { Nav } from "@/components/Nav";
import { logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const pending = u.role === "ADMIN" ? await prisma.dateConfirmation.count({ where: { resolvedAt: null } }) : 0;
  return (
    <>
      <header className="top">
        <div className="ttl">
          <div className="sub">{u.name} · {ROLE_LABEL[u.role]}</div>
          <h1>Thay tủ mát WCM</h1>
        </div>
        <div className="avatar" aria-hidden="true">{(u.name.trim()[0] ?? "W").toUpperCase()}</div>
        <form action={logoutAction}><button title="Đăng xuất">Thoát</button></form>
      </header>
      <main>{children}</main>
      <Nav role={u.role} pending={pending} />
    </>
  );
}
