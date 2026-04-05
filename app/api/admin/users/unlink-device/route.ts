import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Removes a device from a user's account (clears auth_user_id).
 * The user will no longer see the device or be able to top it up.
 * Wallet balance stays tied to device_identifier. Device returns to stock as "available"
 * unless it was archived.
 */
export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    auth_user_id?: string;
    device_identifier?: string;
  };

  const authUserId = (body.auth_user_id ?? "").trim();
  const deviceIdentifier = (body.device_identifier ?? "").trim();

  if (!authUserId || !deviceIdentifier) {
    return Response.json(
      { ok: false, error: "Hiányzó auth_user_id vagy device_identifier." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error: fetchErr } = await supabase
    .from("devices")
    .select("id, auth_user_id, status")
    .eq("identifier", deviceIdentifier)
    .maybeSingle();

  if (fetchErr) {
    return Response.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return Response.json({ ok: false, error: "Nincs ilyen eszköz." }, { status: 404 });
  }
  if (row.auth_user_id !== authUserId) {
    return Response.json(
      { ok: false, error: "Ez az eszköz nem ehhez a felhasználóhoz tartozik." },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const status = String(row.status ?? "").toLowerCase();
  const nextStatus = status === "archived" ? "archived" : "available";

  const { error: updErr } = await supabase
    .from("devices")
    .update({
      auth_user_id: null,
      status: nextStatus,
      sold_at: null,
      assigned_at: null,
      updated_at: now,
    })
    .eq("id", row.id);

  if (updErr) {
    return Response.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
