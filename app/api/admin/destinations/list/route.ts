import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("id, name, price_ia, price_i, price_ii, price_iii, price_iv, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, items: data ?? [] });
}
