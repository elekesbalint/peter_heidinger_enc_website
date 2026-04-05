"use client";

/**
 * Blog / beállítások data URI-k Vercel serverless limitje alá: kisebb JPEG a böngészőben.
 */
export async function compressImageToJpegDataUrl(
  file: File,
  options?: { maxEdge?: number; quality?: number; maxChars?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1280;
  let quality = options?.quality ?? 0.82;
  const maxChars = options?.maxChars ?? 750_000;

  const bitmap = await createImageBitmap(file);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("A böngésző nem tudja tömöríteni a képet (canvas).");

    if (file.type === "image/png" || file.type === "image/webp") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tw, th);
    }
    ctx.drawImage(bitmap, 0, 0, tw, th);

    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    let edge = maxEdge;
    while (dataUrl.length > maxChars && quality > 0.45) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    while (dataUrl.length > maxChars && edge > 640) {
      edge = Math.round(edge * 0.85);
      const scale2 = Math.min(1, edge / Math.max(w, h));
      const t2w = Math.max(1, Math.round(w * scale2));
      const t2h = Math.max(1, Math.round(h * scale2));
      canvas.width = t2w;
      canvas.height = t2h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, t2w, t2h);
      ctx.drawImage(bitmap, 0, 0, t2w, t2h);
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    if (dataUrl.length > maxChars) {
      throw new Error(
        "A tömörített kép még mindig túl nagy a mentéshez. Válassz kisebb felbontású képet, vagy használj külső kép URL-t.",
      );
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
