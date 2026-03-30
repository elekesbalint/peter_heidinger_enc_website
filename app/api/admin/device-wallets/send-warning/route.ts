import { requireAdmin } from "@/lib/admin-guard";
import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json().catch(() => ({}))) as { device_identifiers?: string[] };
  const ids = Array.from(
    new Set((body.device_identifiers ?? []).map((s) => String(s).trim()).filter(Boolean)),
  );
  if (ids.length === 0) {
    return Response.json({ ok: false, error: "Nincs kiválasztott eszköz." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: devices, error: devErr } = await supabase
    .from("devices")
    .select("identifier, auth_user_id")
    .in("identifier", ids);
  if (devErr) return Response.json({ ok: false, error: devErr.message }, { status: 500 });

  const users = new Map<string, { email: string; items: string[] }>();
  for (const d of devices ?? []) {
    if (!d.auth_user_id) continue;
    const u = await supabase.auth.admin.getUserById(d.auth_user_id);
    const email = u.data.user?.email?.trim() ?? "";
    if (!email) continue;
    const prev = users.get(d.auth_user_id);
    if (prev) prev.items.push(d.identifier);
    else users.set(d.auth_user_id, { email, items: [d.identifier] });
  }

  let sent = 0;
  for (const row of users.values()) {
    await sendAppEmail({
      to: row.email,
      subject: "AdriaGo — egyenleg figyelmeztetés",
      text: `Figyelmeztetés: az alábbi eszköz(ök) egyenlege alacsony vagy negatív: ${row.items.join(", ")}. Kérjük töltsd fel az egyenleget.`,
    }).catch((e) => {
      console.error("[wallet-warning] email failed:", e);
    });
    sent += 1;
  }

  return Response.json({ ok: true, sent_users: sent, devices: ids.length });
}

