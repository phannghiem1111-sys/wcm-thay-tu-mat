// Nén ảnh ở trình duyệt trước khi tải lên: cạnh dài tối đa 1600px, JPEG chất lượng 0.75.
export async function compressImage(file: File, maxSide = 1600, quality = 0.75): Promise<File> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new Error("Không nén được ảnh");
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
