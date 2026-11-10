"use client";
import { useEffect, useRef, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "desktop";

const detect = (): Platform => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

/** Nút "Cài app": gọi hộp cài đặt của trình duyệt nếu có, không thì hiện hướng dẫn theo thiết bị. */
export function InstallApp() {
  const prompt = useRef<BIPEvent | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const [installed, setInstalled] = useState(true); // ẩn cho tới khi biết chắc chưa cài
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    setPlatform(detect());
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); prompt.current = e as BIPEvent; };
    const onInstalled = () => { prompt.current = null; setInstalled(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed) return null;

  const click = async () => {
    const p = prompt.current;
    if (p) {
      await p.prompt();
      const r = await p.userChoice;
      prompt.current = null;
      if (r.outcome === "accepted") setInstalled(true);
    } else dlg.current?.showModal();
  };

  const Steps = ({ id, title, steps }: { id: Platform; title: string; steps: string[] }) => (
    <section style={{ opacity: platform === id ? 1 : 0.6, marginBottom: 12 }}>
      <h3>{title}{platform === id ? " (máy của bạn)" : ""}</h3>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>{steps.map((t) => <li key={t}>{t}</li>)}</ol>
    </section>
  );

  return (
    <>
      <button type="button" className="install-btn" onClick={click}>📲 Cài app</button>
      <dialog ref={dlg} className="install-dlg" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <h2 style={{ marginTop: 0 }}>Cài app lên điện thoại</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Cài xong có biểu tượng ngoài màn hình chính, mở như app thường, không cần gõ địa chỉ.</p>
        <Steps id="ios" title="iPhone / iPad (Safari)" steps={["Mở trang này bằng Safari (không dùng Chrome).", "Bấm nút Chia sẻ (hình vuông có mũi tên lên) ở thanh dưới.", "Kéo xuống chọn “Thêm vào MH chính” (Add to Home Screen).", "Bấm “Thêm”."]} />
        <Steps id="android" title="Android (Chrome)" steps={["Bấm dấu ⋮ góc phải trên của Chrome.", "Chọn “Cài đặt ứng dụng” hoặc “Thêm vào Màn hình chính”.", "Bấm “Cài đặt”."]} />
        <Steps id="desktop" title="Máy tính (Chrome / Edge)" steps={["Bấm biểu tượng cài đặt ở cuối thanh địa chỉ (hình màn hình có mũi tên xuống).", "Bấm “Cài đặt”."]} />
        <button type="button" className="btn pri big" onClick={() => dlg.current?.close()}>Đã hiểu</button>
      </dialog>
    </>
  );
}
