import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    name?: string | null;
    phone?: string | null;
    billing_address?: string | null;
    shipping_address?: string | null;
  };

  const id = (body.id ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, error: "Hiányzó user azonosító." }, { status: 400 });
  }

  const patch = {
    auth_user_id: id,
    name: body.name == null ? null : String(body.name).trim() || null,
    phone: body.phone == null ? null : String(body.phone).trim() || null,
    billing_address:
      body.billing_address == null ? null : String(body.billing_address).trim() || null,
    shipping_address:
      body.shipping_address == null ? null : String(body.shipping_address).trim() || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "auth_user_id" });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

