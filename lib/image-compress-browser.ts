"use client";

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b != null ? resolve(b) : reject(new Error("Kép tömörítés sikertelen."))),
      "image/jpeg",
      quality,
    );
  });
}

type PreparedCanvas = {
  canvas: HTMLCanvasElement;
  bitmap: ImageBitmap;
  origW: number;
  origH: number;
};

async function prepareCanvasFromFile(file: File, maxEdge: number): Promise<PreparedCanvas> {
  const bitmap = await createImageBitmap(file);
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("A böngésző nem tudja tömöríteni a képet (canvas).");
  }

  if (file.type === "image/png" || file.type === "image/webp") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tw, th);
  }
  ctx.drawImage(bitmap, 0, 0, tw, th);

  return { canvas, bitmap, origW: w, origH: h };
}

async function jpegBlobUnderLimit(
  prepared: PreparedCanvas,
  maxEdgeStart: number,
  qualityStart: number,
  maxBytes: number,
): Promise<Blob> {
  const { canvas, bitmap, origW, origH } = prepared;
  let quality = qualityStart;
  let edge = maxEdgeStart;

  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > maxBytes && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToJpegBlob(canvas, quality);
  }
  while (blob.size > maxBytes && edge > 640) {
    edge = Math.round(edge * 0.85);
    const scale2 = Math.min(1, edge / Math.max(origW, origH));
    const t2w = Math.max(1, Math.round(origW * scale2));
    const t2h = Math.max(1, Math.round(origH * scale2));
    canvas.width = t2w;
    canvas.height = t2h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas hiba.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, t2w, t2h);
    ctx.drawImage(bitmap, 0, 0, t2w, t2h);
    blob = await canvasToJpegBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    throw new Error(
      "A tömörített kép még mindig túl nagy. Válassz kisebb képet, vagy használj külső kép URL-t.",
    );
  }
  return blob;
}

/**
 * Blog / beállítások data URI-k Vercel limitje alá (hero stb., ha még data URI kell).
 */
export async function compressImageToJpegDataUrl(
  file: File,
  options?: { maxEdge?: number; quality?: number; maxChars?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1280;
  const quality = options?.quality ?? 0.82;
  const maxChars = options?.maxChars ?? 750_000;

  const prepared = await prepareCanvasFromFile(file, maxEdge);
  try {
    const maxBytes = Math.min(maxChars, 900_000);
    const blob = await jpegBlobUnderLimit(prepared, maxEdge, quality, maxBytes);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(new Error("Olvasás hiba."));
      r.readAsDataURL(blob);
    });
    if (dataUrl.length > maxChars) {
      throw new Error(
        "A tömörített kép még mindig túl nagy a mentéshez. Válassz kisebb felbontású képet, vagy használj külső kép URL-t.",
      );
    }
    return dataUrl;
  } finally {
    prepared.bitmap.close();
  }
}

/** Supabase Storage feltöltéshez: kis JPEG Blob (~maxBytes alatt). */
export async function compressImageToJpegBlob(
  file: File,
  options?: { maxEdge?: number; quality?: number; maxBytes?: number },
): Promise<Blob> {
  const maxEdge = options?.maxEdge ?? 1400;
  const quality = options?.quality ?? 0.82;
  const maxBytes = options?.maxBytes ?? 420_000;

  const prepared = await prepareCanvasFromFile(file, maxEdge);
  try {
    return await jpegBlobUnderLimit(prepared, maxEdge, quality, maxBytes);
  } finally {
    prepared.bitmap.close();
  }
}
