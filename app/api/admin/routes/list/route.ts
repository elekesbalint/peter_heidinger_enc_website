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
    .from("route_records")
    .select(
      "id, device_number_raw, relation_label, executed_at, amount, currency, source_file_name",
    )
    .order("executed_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(
      [
        `device_number_raw.ilike.%${q}%`,
        `source_file_name.ilike.%${q}%`,
        `relation_label.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, items: data ?? [] });
}
