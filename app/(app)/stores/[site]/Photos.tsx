"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compress";
import { deletePhoto } from "./actions";

export type PhotoItem = { id: string; url: string; mine: boolean };

export function Photos({ site, photos, canEdit, storageReady }: { site: string; photos: PhotoItem[]; canEdit: boolean; storageReady: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    try {
      for (const f of Array.from(files)) {
        const small = await compressImage(f);
        const fd = new FormData();
        fd.set("site", site); fd.set("file", small);
        const r = await fetch("/api/photos", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Tải ảnh lỗi");
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="card" id="anh">
      <h3>Ảnh hiện trường ({photos.length}/10)</h3>
      {err && <div className="err">{err}</div>}
      {photos.length > 0 && (
        <div className="photos" style={{ marginBottom: 10 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <a href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt="Ảnh hiện trường" loading="lazy" /></a>
              {canEdit && p.mine && (
                <button className="btn sm danger" style={{ position: "absolute", right: 2, top: 2, minHeight: 28, padding: "0 8px" }} disabled={pending}
                  onClick={() => { if (confirm("Xoá ảnh này?")) start(async () => { const r = await deletePhoto(p.id); if (!r.ok) setErr(r.errors.join(", ")); else router.refresh(); }); }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit ? (
        storageReady ? (
          <>
            <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hide" onChange={(e) => onPick(e.target.files)} />
            <button className="btn pri big" disabled={busy || photos.length >= 10} onClick={() => input.current?.click()}>{busy ? "Đang nén và tải lên…" : "📷 Chụp / chọn ảnh"}</button>
          </>
        ) : <p className="small muted">Chưa cấu hình kho ảnh (xem README).</p>
      ) : photos.length === 0 && <p className="small muted">Chưa có ảnh.</p>}
    </div>
  );
}
