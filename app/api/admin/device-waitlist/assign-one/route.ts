import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type WaitlistItem = {
  id: string;
  auth_user_id: string;
  user_email: string | null;
  category: string;
};

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const waitlistId = (body.id ?? "").trim();
  if (!waitlistId) {
    return Response.json({ ok: false, error: "Hiányzó várólista azonosító." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: req, error: reqErr } = await supabase
    .from("device_waitlist")
    .select("id, auth_user_id, user_email, category")
    .eq("id", waitlistId)
    .maybeSingle<WaitlistItem>();
  if (reqErr || !req) {
    return Response.json({ ok: false, error: "Várólista elem nem található." }, { status: 404 });
  }

  const { data: device, error: devErr } = await supabase
    .from("devices")
    .select("id, identifier")
    .eq("status", "available")
    .eq("category", req.category)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (devErr) {
    return Response.json({ ok: false, error: devErr.message }, { status: 500 });
  }
  if (!device) {
    return Response.json(
      { ok: false, error: "Nincs szabad készülék ebben a kategóriában." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data: updatedRows, error: updErr } = await supabase
    .from("devices")
    .update({
      status: "sold",
      auth_user_id: req.auth_user_id,
      assigned_at: now,
      sold_at: now,
      updated_at: now,
    })
    .eq("id", device.id)
    .eq("status", "available")
    .select("id");
  if (updErr) {
    return Response.json({ ok: false, error: updErr.message }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    return Response.json({ ok: false, error: "A készüléket közben kiosztották." }, { status: 409 });
  }

  const { error: deleteErr } = await supabase.from("device_waitlist").delete().eq("id", waitlistId);
  if (deleteErr) {
    return Response.json({ ok: false, error: deleteErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    item: {
      waitlist_id: req.id,
      user_email: req.user_email,
      category: req.category,
      device_identifier: device.identifier,
    },
  });
}

