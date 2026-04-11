import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_AVATARS ?? "avatars";
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return Response.json({ ok: false, error: "Hiányzó bearer token." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return Response.json({ ok: false, error: "Érvénytelen token." }, { status: 401 });
    }
    const user = authData.user;

    const body = (await request.json()) as { imageBase64?: string; mimeType?: string };
    const raw = body.imageBase64?.trim();
    if (!raw) {
      return Response.json({ ok: false, error: "Hiányzik a kép." }, { status: 400 });
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(raw, "base64");
    } catch {
      return Response.json({ ok: false, error: "Érvénytelen képformátum." }, { status: 400 });
    }

    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return Response.json({ ok: false, error: "A kép legfeljebb 2 MB lehet." }, { status: 400 });
    }

    const mime = String(body.mimeType ?? "image/jpeg").toLowerCase();
    const ext = mime.includes("png") ? "png" : "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    const objectPath = `${user.id}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
      contentType,
      upsert: true,
    });

    if (upErr) {
      const msg = upErr.message ?? "Storage hiba.";
      const hint =
        msg.toLowerCase().includes("bucket") || msg.toLowerCase().includes("not found")
          ? ` Hozd létre a „${BUCKET}” bucketet a Supabase Storage-ban (nyilvános olvasás).`
          : "";
      return Response.json({ ok: false, error: `${msg}${hint}` }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const publicUrl = pub.publicUrl;
    const updatedAt = new Date().toISOString();

    const { data: existing } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, updated_at: updatedAt })
        .eq("auth_user_id", user.id);
      if (dbErr) {
        return Response.json({ ok: false, error: dbErr.message }, { status: 500 });
      }
    } else {
      const { error: dbErr } = await supabase.from("profiles").insert({
        auth_user_id: user.id,
        user_type: "private",
        avatar_url: publicUrl,
        updated_at: updatedAt,
      });
      if (dbErr) {
        return Response.json({ ok: false, error: dbErr.message }, { status: 500 });
      }
    }

    return Response.json({ ok: true, avatarUrl: publicUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
