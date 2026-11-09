"use server";
import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { parseWorkbook, type ImportResult } from "@/lib/import/parse";
import { applyImport, type ApplySummary } from "@/lib/import/apply";

const MAX = 5 * 1024 * 1024;

async function readFile(fd: FormData): Promise<Buffer> {
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) throw new Error("Chưa chọn file");
  if (f.size > MAX) throw new Error("File quá lớn (tối đa 5 MB)");
  if (!/\.xlsx?$/i.test(f.name)) throw new Error("Chỉ nhận file .xlsx");
  return Buffer.from(await f.arrayBuffer());
}

export type PreviewState = { ok: true; result: ImportResult; existing: string[] } | { ok: false; error: string };

export async function previewImport(fd: FormData): Promise<PreviewState> {
  try {
    await requireAction(can.importExcel);
    const result = parseWorkbook(await readFile(fd));
    const existing = (await prisma.store.findMany({ select: { site: true } })).map((s) => s.site);
    return { ok: true, result, existing };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function commitImport(fd: FormData): Promise<{ ok: true; summary: ApplySummary; skipped: number } | { ok: false; error: string }> {
  try {
    const u = await requireAction(can.importExcel);
    const result = parseWorkbook(await readFile(fd));
    if (!result.rows.length) return { ok: false, error: "Không có dòng hợp lệ để nhập" };
    const summary = await applyImport(prisma, result, u.id);
    revalidatePath("/", "layout");
    return { ok: true, summary, skipped: result.errors.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
