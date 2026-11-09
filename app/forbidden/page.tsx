import Link from "next/link";
export default function Forbidden() {
  return (
    <main>
      <div className="login card">
        <h2>Không có quyền truy cập</h2>
        <p>Tài khoản của bạn không được xem trang này.</p>
        <Link className="btn" href="/">Về trang tổng quan</Link>
      </div>
    </main>
  );
}
