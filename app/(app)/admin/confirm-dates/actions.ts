"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/dates";
import { DATE_FIELD_TO_KEY } from "@/lib/import/apply";

type Choice = "asIs" | "swapped";

async function resolve(ids: string[], choice: Choice, userId: string) {
  await prisma.$transaction(async (tx) => {
    const items = await tx.dateConfirmation.findMany({ where: { id: { in: ids }, resolvedAt: null }, include: { store: true } });
    for (const c of items) {
      const value = choice === "swapped" ? c.valueSwapped : c.valueAsIs;
      if (choice === "swapped" && !c.valueSwapped) continue;
      const key = DATE_FIELD_TO_KEY[c.field];
      const old = (c.store as Record<string, unknown>)[key] as Date | null;
      await tx.store.update({ where: { id: c.storeId }, data: { [key]: value } as Prisma.StoreUpdateInput });
      await tx.dateConfirmation.update({ where: { id: c.id }, data: { resolvedAt: new Date(), resolvedById: userId } });
      await tx.auditLog.create({
        data: { storeId: c.storeId, userId, action: `Xác nhận ngày (${choice === "swapped" ? "đảo ngày/tháng" : "giữ như file"})`, changes: { [key]: { old: toISODate(old), new: toISODate(value) } } },
      });
    }
  });
  revalidatePath("/", "layout");
}

export async function resolveOne(id: string, choice: Choice) {
  const u = await requireAction(can.confirmDates);
  await resolve([id], choice, u.id);
}
export async function resolveAll(choice: Choice) {
  const u = await requireAction(can.confirmDates);
  const ids = (await prisma.dateConfirmation.findMany({ where: { resolvedAt: null }, select: { id: true } })).map((x) => x.id);
  await resolve(ids, choice, u.id);
}
