import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/domain";
import { AutoAssign, CreateUserForm } from "./Forms";

export default async function Users() {
  await requirePage(can.manageUsers);
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], include: { _count: { select: { assignments: true } } } });
  return (
    <>
      <h2>Người dùng & phân quyền</h2>
      <div className="card">
        <table className="t"><thead><tr><th>Tên</th><th>Vai trò</th><th className="n">CH gán</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
              <td><Link href={`/admin/users/${u.id}`}>{u.name}</Link><div className="small muted">{u.email}{u.active ? "" : " · đã khoá"}</div></td>
              <td>{ROLE_LABEL[u.role]}</td>
              <td className="n">{u.role === "DOI_TRUONG" || u.role === "NHA_THAU" ? u._count.assignments : "—"}</td>
            </tr>
          ))}</tbody></table>
      </div>
      <AutoAssign />
      <CreateUserForm />
    </>
  );
}
