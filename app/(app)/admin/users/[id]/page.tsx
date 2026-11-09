import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { AssignForm, EditUserForm } from "../Forms";

const uniq = (a: (string | null)[]) => [...new Set(a.filter(Boolean) as string[])].sort((x, y) => x.localeCompare(y, "vi"));

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePage(can.manageUsers);
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, include: { assignments: { select: { storeId: true } } } });
  if (!u) notFound();
  const stores = await prisma.store.findMany({
    orderBy: [{ stt: "asc" }],
    select: { id: true, site: true, tenCuaHang: true, tinh: true, doiTruongKtkv: true, nhaThauLapDat: true, nhaThauVanChuyen: true },
  });
  const scoped = u.role === "DOI_TRUONG" || u.role === "NHA_THAU";
  const groups = u.role === "DOI_TRUONG"
    ? [{ label: "Đội trưởng KTKV", values: uniq(stores.map((s) => s.doiTruongKtkv)) }]
    : [{ label: "Nhà thầu", values: uniq(stores.flatMap((s) => [s.nhaThauLapDat, s.nhaThauVanChuyen])) }];
  return (
    <>
      <p className="small"><Link href="/admin/users">← Người dùng</Link></p>
      <h2>{u.name} <span className="small muted">{u.email}</span></h2>
      <EditUserForm u={{ id: u.id, name: u.name, role: u.role, active: u.active }} />
      {scoped
        ? <AssignForm userId={u.id} stores={stores} assigned={u.assignments.map((a) => a.storeId)} groups={groups} />
        : <div className="card small muted">Vai trò này không cần gán cửa hàng (Admin sửa được tất cả; Người xem chỉ xem dashboard).</div>}
    </>
  );
}
