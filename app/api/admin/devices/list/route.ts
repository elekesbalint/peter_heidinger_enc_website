import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return Response.json({ ok: false, error: "Nincs admin jogosultsag." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  let query = supabase
    .from("devices")
    .select("id, identifier, category, status, auth_user_id, license_plate, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.ilike("identifier", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, items: data ?? [] });
}
