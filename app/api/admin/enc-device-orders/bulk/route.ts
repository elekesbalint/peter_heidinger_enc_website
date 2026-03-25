import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Action = "archive" | "restore" | "cancel";

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    ids?: string[];
    action?: Action;
  };

  const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x).trim()).filter(Boolean) : [];
  const action = body.action;
  if (ids.length === 0 || !action) {
    return Response.json({ ok: false, error: "Hianyzo ids vagy action." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  let patch: Record<string, string | null> = {};
  if (action === "archive") patch = { archived_at: now };
  else if (action === "restore") patch = { archived_at: null };
  else if (action === "cancel") patch = { cancelled_at: now };
  else {
    return Response.json({ ok: false, error: "Bulk action csak archive, restore, cancel." }, { status: 400 });
  }

  const { error } = await supabase.from("enc_device_orders").update(patch).in("id", ids);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, updated: ids.length });
}
