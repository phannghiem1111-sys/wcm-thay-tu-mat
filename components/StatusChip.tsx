import type { StoreStatus } from "@prisma/client";
import { STATUS_LABEL, statusIndex } from "@/lib/domain";
export function StatusChip({ s }: { s: StoreStatus }) {
  return <span className={`chip st-${statusIndex(s)}`}>{STATUS_LABEL[s]}</span>;
}
