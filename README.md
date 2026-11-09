# Theo dõi thay tủ mát WCM — Giai đoạn 1

Next.js 15 (App Router) + TypeScript + PostgreSQL (Prisma). Giao diện tiếng Việt, tối ưu điện thoại, cài được như PWA.

**Giai đoạn 1 gồm:** schema DB, đăng nhập email/mật khẩu, phân quyền kiểm tra ở server, import Excel (báo lỗi từng dòng, ngày nghi đảo → danh sách xác nhận), seed script, dashboard, danh sách + chi tiết (chỉ đọc), quản lý người dùng & gán cửa hàng, test.
**Giai đoạn 2 (chưa làm):** cập nhật nhanh, ảnh (object storage), export Excel, service worker offline.

## Chạy local
```bash
cp .env.example .env            # điền DATABASE_URL, AUTH_SECRET (openssl rand -base64 48), ADMIN_*
npm install
npx prisma migrate dev          # tạo bảng
cp <file Excel> data/DS_Thay_tu_mat_WCM_tracking_final.xlsx
npm run db:seed                 # tạo Admin + nạp 47 cửa hàng (chạy lại nhiều lần không trùng)
npm run dev                     # http://localhost:3000
npm test                        # test logic trạng thái, phân quyền, %, import
```
Cần PostgreSQL 14+. Nhanh nhất: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tumat postgres:16`.

## Deploy Vercel
1. Đẩy code lên GitHub (file Excel thật trong `data/` đã bị `.gitignore` vì chứa SĐT cá nhân).
2. Vercel → New Project → import repo.
3. Storage → thêm **Neon Postgres** (Marketplace). Đặt Custom Prefix = `DATABASE` để có `DATABASE_URL` (pooled) và `DATABASE_URL_UNPOOLED`.
4. Thêm biến `AUTH_SECRET`.
5. Không cần sửa build command: script `vercel-build` tự chạy `prisma migrate deploy`.
6. Seed lần đầu từ máy local, trỏ `DATABASE_URL`/`DATABASE_URL_UNPOOLED` vào DB Neon: `npm run db:seed`. Hoặc đăng nhập Admin rồi dùng màn Import.

## Phân quyền (kiểm tra ở server: `lib/permissions.ts`, `lib/auth.ts`)
| Vai trò | Dashboard | Danh sách/Chi tiết | Sửa (giai đoạn 2) | Import, người dùng, xác nhận ngày |
|---|---|---|---|---|
| Admin | ✓ | ✓ | mọi cửa hàng, mọi trường | ✓ |
| Đội trưởng KTKV | ✓ | ✓ | chỉ CH **được gán**: trạng thái, ngày, serial, nhà thầu, KTKV, CHT, ghi chú, ảnh | ✗ |
| Nhà thầu | ✓ | ✓ | chỉ CH **được gán**: ngày VC/lắp thực tế, serial, trạng thái (không nghiệm thu), ảnh | ✗ |
| Người xem | ✓ | ✗ | ✗ | ✗ |

- Mọi page gọi `requirePage(...)`, mọi server action gọi `requireAction(...)`. Vai trò đọc lại từ DB ở mỗi request.
- Gán cửa hàng: Admin → Người dùng → chọn người → chọn nhanh theo tên trong cột “Đội trưởng KTKV” / “Nhà thầu”.

## Quy tắc dữ liệu
- Ngày lưu kiểu `DATE`, hiển thị dd/mm/yyyy. Import chấp nhận ô ngày thật và chuỗi `dd/mm/yyyy`.
- **Ngày nghi đảo ngày/tháng**: ô ngày thật có ngày ≤ 12 và khác tháng (vd 11/09), hoặc chuỗi chỉ hợp lệ khi đọc mm/dd. Hệ thống giữ giá trị như file, **không tự sửa**, tạo bản ghi `DateConfirmation`. Admin chọn cách đọc ở `/admin/confirm-dates`. Import lại không ghi đè ngày đã xác nhận.
- Import khớp theo Site. Ô trống không xoá dữ liệu đã có. Dòng thiếu Site, thiếu Tên CH hoặc trùng Site sẽ bị bỏ qua và báo lỗi theo dòng. Trạng thái, số hoặc ngày sai vẫn được nhập nhưng có cảnh báo.
- Hoàn thành = Hoàn thành + Đã nghiệm thu. Trễ = ngày lắp DK < hôm nay (giờ VN) và chưa hoàn thành. % làm tròn 1 số lẻ.
- Tổng = Số lượng × (ĐG tài sản + ĐG V/C + ĐG lắp đặt). “Kiểm tra dữ liệu” tự tính (`dataFlags`).
- Mọi thay đổi ghi `AuditLog` (người, thời điểm, giá trị cũ → mới).

## Cấu trúc
```
prisma/schema.prisma   bảng User, Store, StoreAssignment, DateConfirmation, AuditLog, Photo
prisma/seed.ts         seed Admin + Excel
lib/domain.ts          trạng thái, trễ, %, dashboard, cờ lỗi, kiểm tra chuyển trạng thái
lib/permissions.ts     quyền theo vai trò / cửa hàng được gán / trường
lib/dates.ts           chuẩn hoá & phát hiện ngày nghi đảo
lib/import/            parse.ts (đọc Excel), apply.ts (ghi DB + audit)
app/(app)/             dashboard, stores, admin/import, admin/confirm-dates, admin/users
tests/                 vitest
```
