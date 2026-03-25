import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("perPage") ?? "50", 10) || 50));

  const supabase = createSupabaseAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page,
    perPage,
  });

  if (authError) {
    return Response.json({ ok: false, error: authError.message }, { status: 500 });
  }

  const users = authData.users ?? [];
  const ids = users.map((u) => u.id);

  let profileByUser = new Map<string, { name: string | null; phone: string | null }>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("auth_user_id, name, phone")
      .in("auth_user_id", ids);
    for (const p of profiles ?? []) {
      profileByUser.set(p.auth_user_id, { name: p.name, phone: p.phone });
    }
  }

  const items = users.map((u) => {
    const pr = profileByUser.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      name: pr?.name ?? null,
      phone: pr?.phone ?? null,
    };
  });

  return Response.json({
    ok: true,
    items,
    page,
    perPage,
    total: authData.total ?? items.length,
  });
}
