# Theo dõi thay tủ mát WCM (PWA)

Web app tĩnh (HTML/JS, không cần build), chạy trên điện thoại qua trình duyệt, "Thêm vào màn hình chính" để dùng như app.

## Chạy thử ngay (chế độ thử)
Mở `index.html` qua một web server bất kỳ (vd. `python3 -m http.server`), đăng nhập "Trưởng phòng KT (demo)" → Thêm → Import Excel.
Dữ liệu chế độ thử chỉ nằm trên trình duyệt đó.

## Dùng thật nhiều người (Supabase, gói Free đủ dùng)
1. Tạo project tại supabase.com → SQL Editor → chạy `supabase/schema.sql`.
2. Project Settings → API: chép `Project URL` và `anon public key` vào `config.js`.
3. Đưa thư mục lên hosting tĩnh HTTPS (Vercel / Netlify / GitHub Pages / Cloudflare Pages).
4. Mở app, **đăng ký tài khoản đầu tiên → tự thành Admin**. Import file Excel.
5. Người khác tự đăng ký → Admin vào "Quản lý người dùng" cấp vai trò + phạm vi.

## Phân quyền (kiểm soát ở cả app và database)
| Vai trò | Xem | Sửa |
|---|---|---|
| Admin | tất cả | tất cả, import/export, người dùng, xác nhận ngày |
| Đội trưởng KTKV | tất cả | CH có cột "Đội trưởng KTKV" chứa phạm vi: trạng thái, ngày DK/TT, serial TT, nhà thầu, KTKV, CHT/SĐT, ghi chú, ảnh |
| Nhà thầu | tất cả | CH có cột Nhà thầu chứa phạm vi: ngày VC/lắp TT, serial TT, trạng thái (trừ "Đã nghiệm thu"), ghi chú, ảnh |
| Người xem | tất cả | không |

## Quy tắc dữ liệu
- Import khớp theo **Site**; ô trống trong file không xoá dữ liệu đã nhập trên app.
- Ngày kiểu Excel có ngày ≤ 12 (vd 11/09) bị nghi đảo ngày/tháng: giữ nguyên, đưa vào màn "Xác nhận".
- Trễ tiến độ = ngày lắp DK < hôm nay và chưa Hoàn thành/Đã nghiệm thu.
- Tổng = Số lượng × (ĐG tài sản + ĐG V/C + ĐG lắp đặt).
- Ảnh nén ≤1600px JPEG trước khi tải; lưu bucket riêng tư `photos`.
- Mọi thay đổi ghi audit log (người, thời điểm, giá trị cũ → mới).
