import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatVN } from "@/lib/dates";
import { AllButton, OneButton } from "./ConfirmButtons";

const FIELD_LABEL: Record<string, string> = { VC_DU_KIEN: "Ngày VC - DỰ KIẾN", VC_THUC_TE: "Ngày VC - THỰC TẾ", LAP_DU_KIEN: "Ngày lắp - DỰ KIẾN", LAP_THUC_TE: "Ngày lắp - THỰC TẾ" };

export default async function ConfirmDates() {
  await requirePage(can.confirmDates);
  const items = await prisma.dateConfirmation.findMany({
    where: { resolvedAt: null },
    include: { store: { select: { site: true, tinh: true, stt: true, tenCuaHang: true } } },
    orderBy: [{ store: { stt: "asc" } }, { field: "asc" }],
  });
  const swappable = items.filter((i) => i.valueSwapped).length;
  return (
    <>
      <p className="small"><Link href="/admin/import">← Import</Link></p>
      <h2>Ngày cần xác nhận ({items.length})</h2>
      <p className="small muted">Ô ngày trong Excel có số ngày ≤ 12 có thể bị đảo ngày/tháng. Hệ thống <b>không tự sửa</b>; đang lưu theo cách đọc “như file”. Chọn cách đọc đúng.</p>
      {items.length > 0 ? (
        <div className="card"><h3>Xác nhận hàng loạt</h3><div className="row">
          <AllButton choice="asIs" count={items.length}>Tất cả: giữ như file</AllButton>
          <AllButton choice="swapped" count={swappable}>Tất cả: đảo ngày/tháng</AllButton>
        </div></div>
      ) : <div className="okmsg">Không còn ngày nào cần xác nhận.</div>}
      {items.map((c) => (
        <div key={c.id} className="pend">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b><Link href={`/stores/${encodeURIComponent(c.store.site)}`}>{c.store.site}</Link> · {FIELD_LABEL[c.field]}</b>
            <span className="small muted">{c.store.tinh}</span>
          </div>
          {c.note && <div className="small muted">{c.note}</div>}
          <div className="opts">
            {c.valueAsIs && <OneButton id={c.id} choice="asIs">{formatVN(c.valueAsIs)}<br /><span className="small muted">giữ như file</span></OneButton>}
            {c.valueSwapped && <OneButton id={c.id} choice="swapped">{formatVN(c.valueSwapped)}<br /><span className="small muted">đảo ngày/tháng</span></OneButton>}
          </div>
        </div>
      ))}
    </>
  );
}
