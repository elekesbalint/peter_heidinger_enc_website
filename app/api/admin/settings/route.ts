import { requireAdmin } from "@/lib/admin-guard";
import { SETTINGS_DEFAULTS } from "@/lib/app-settings";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("settings").select("key, value, updated_at").order("key");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rowMap = new Map(
    (data ?? []).map((row) => [row.key, row] as const),
  );
  const merged = Object.keys(SETTINGS_DEFAULTS)
    .map((key) => {
      const row = rowMap.get(key);
      return {
        key,
        value: row?.value ?? SETTINGS_DEFAULTS[key] ?? "",
        updated_at: row?.updated_at ?? "",
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return Response.json({ ok: true, items: merged });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    entries?: { key: string; value: string }[];
  };

  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) {
    return Response.json({ ok: false, error: "Ures entries." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const allowedKeys = new Set(Object.keys(SETTINGS_DEFAULTS));

  for (const e of entries) {
    const key = String(e.key ?? "").trim();
    const value = String(e.value ?? "").trim();
    if (!key || !allowedKeys.has(key)) continue;
    const { error } = await supabase
      .from("settings")
      .upsert({ key, value, updated_at: now }, { onConflict: "key" });
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
