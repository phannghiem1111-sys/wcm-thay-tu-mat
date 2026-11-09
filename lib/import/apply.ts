// Ghi kết quả import vào DB: upsert theo Site, ô trống không ghi đè, ghi audit log, tạo danh sách ngày cần xác nhận.
import type { Prisma, PrismaClient } from "@prisma/client";
import { fromISODate, toISODate } from "../dates";
import { COLUMNS, DATE_FIELD_MAP, type ImportResult, type ParsedStore, type StoreKey } from "./parse";

const kindOf = new Map(COLUMNS.map(([k, , kind]) => [k, kind]));

function toPrismaValue(k: StoreKey, v: string | number | null): unknown {
  const kind = kindOf.get(k);
  if (v === null) return null;
  if (kind === "date" || kind === "month") return fromISODate(String(v));
  if (kind === "money") return BigInt(Math.round(Number(v)));
  return v;
}
/** Giá trị để so sánh/ghi audit (chuỗi/số thuần) */
function plain(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return toISODate(v);
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && "toNumber" in (v as object)) return (v as { toNumber(): number }).toNumber();
  return v as string | number;
}

export type ApplySummary = { created: number; updated: number; unchanged: number; pendingDates: number };

export async function applyImport(prisma: PrismaClient, result: ImportResult, userId: string | null): Promise<ApplySummary> {
  const sum: ApplySummary = { created: 0, updated: 0, unchanged: 0, pendingDates: 0 };
  const pendingBySite = new Map<string, typeof result.pending>();
  for (const p of result.pending) pendingBySite.set(p.site, [...(pendingBySite.get(p.site) ?? []), p]);

  await prisma.$transaction(
    async (tx) => {
      for (const row of result.rows) {
        const existing = await tx.store.findUnique({ where: { site: row.site }, include: { dateConfirmations: true } });
        const data: Record<string, unknown> = {};
        const skipKeys = new Set<StoreKey>();
        // ngày đã được Admin xác nhận trước đó: không ghi đè bằng giá trị nghi đảo y hệt trong file
        for (const p of pendingBySite.get(row.site) ?? []) {
          const done = existing?.dateConfirmations.find((c) => c.field === p.field && c.resolvedAt);
          if (done && toISODate(done.valueAsIs) === p.asIs) skipKeys.add(p.key);
        }
        for (const [k, v] of Object.entries(row) as [StoreKey, ParsedStore[StoreKey]][]) {
          if (k === "site" || skipKeys.has(k)) continue;
          if (v === null || v === undefined) continue; // ô trống không xoá dữ liệu đã có
          data[k] = toPrismaValue(k, v as string | number);
        }

        let storeId: string;
        if (!existing) {
          const created = await tx.store.create({ data: { ...data, site: row.site } as Prisma.StoreCreateInput });
          storeId = created.id;
          sum.created++;
          await tx.auditLog.create({ data: { storeId, userId, action: "Import Excel — tạo mới" } });
        } else {
          storeId = existing.id;
          const changes: Record<string, { old: unknown; new: unknown }> = {};
          for (const [k, v] of Object.entries(data)) {
            const o = plain((existing as Record<string, unknown>)[k]);
            const n = plain(v);
            if (String(o) !== String(n)) changes[k] = { old: o, new: n };
          }
          if (Object.keys(changes).length) {
            await tx.store.update({ where: { id: storeId }, data: data as Prisma.StoreUpdateInput });
            await tx.auditLog.create({ data: { storeId, userId, action: "Import Excel — cập nhật", changes: changes as Prisma.InputJsonValue } });
            sum.updated++;
          } else sum.unchanged++;
        }

        for (const p of pendingBySite.get(row.site) ?? []) {
          if (skipKeys.has(p.key)) continue;
          await tx.dateConfirmation.upsert({
            where: { storeId_field: { storeId, field: p.field } },
            create: { storeId, field: p.field, valueAsIs: fromISODate(p.asIs), valueSwapped: fromISODate(p.swapped), note: p.note },
            update: { valueAsIs: fromISODate(p.asIs), valueSwapped: fromISODate(p.swapped), note: p.note, resolvedAt: null, resolvedById: null },
          });
          sum.pendingDates++;
        }
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return sum;
}

export const DATE_FIELD_TO_KEY = Object.fromEntries(Object.entries(DATE_FIELD_MAP).map(([k, f]) => [f, k])) as Record<string, StoreKey>;
