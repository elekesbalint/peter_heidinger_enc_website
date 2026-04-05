import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/** Supabase: hozz létre nyilvános bucketet (pl. `blog-images`), olvasás: public. */
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BLOG ?? "blog-images";

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "Érvénytelen feltöltés." }, { status: 400 });
  }

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "cover");

  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ ok: false, error: "Nincs fájl." }, { status: 400 });
  }

  const type = file.type || "application/octet-stream";
  if (!type.startsWith("image/")) {
    return Response.json({ ok: false, error: "Csak képfájl engedélyezett." }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ ok: false, error: "A fájl legfeljebb 2 MB lehet." }, { status: 400 });
  }

  const folder = kind === "content" ? "content" : "covers";
  const ext = type.includes("png") ? "png" : "jpg";
  const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const supabase = createSupabaseAdminClient();
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: type === "image/png" ? "image/png" : "image/jpeg",
    upsert: false,
  });

  if (upErr) {
    const msg = upErr.message ?? "Storage hiba.";
    const hint =
      msg.toLowerCase().includes("bucket") || msg.toLowerCase().includes("not found")
        ? ` Hozd létre a „${BUCKET}” bucketet a Supabase Storage-ban (public olvasás).`
        : "";
    return Response.json({ ok: false, error: `${msg}${hint}` }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return Response.json({ ok: true, url: pub.publicUrl });
}
