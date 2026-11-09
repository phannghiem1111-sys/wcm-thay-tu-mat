// Seed: tạo Admin + nạp dữ liệu từ file Excel.
//   SEED_EXCEL=./data/DS_Thay_tu_mat_WCM_tracking_final.xlsx ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parseWorkbook } from "../lib/import/parse";
import { applyImport } from "../lib/import/apply";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 8) throw new Error("Cần ADMIN_EMAIL và ADMIN_PASSWORD (≥ 8 ký tự)");
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", active: true },
    create: { email, name: process.env.ADMIN_NAME ?? "Trưởng phòng KT", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Admin: ${admin.email}`);

  const file = process.env.SEED_EXCEL ?? "./data/DS_Thay_tu_mat_WCM_tracking_final.xlsx";
  if (!existsSync(file)) {
    console.log(`Không thấy ${file} — bỏ qua nạp dữ liệu (có thể import trên giao diện).`);
    return;
  }
  const res = parseWorkbook(readFileSync(file));
  for (const e of res.errors) console.log(`  [LỖI] dòng ${e.row} ${e.site ?? ""}: ${e.message}`);
  for (const w of res.warnings) console.log(`  [CẢNH BÁO] dòng ${w.row} ${w.site ?? ""} ${w.column ?? ""}: ${w.message}`);
  const sum = await applyImport(prisma, res, admin.id);
  console.log(`Nạp ${res.rows.length} cửa hàng: ${sum.created} mới, ${sum.updated} cập nhật, ${sum.unchanged} không đổi; ${sum.pendingDates} ngày cần xác nhận; ${res.errors.length} dòng lỗi.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
