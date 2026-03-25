import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return Response.json({ ok: false, error: "Nincs admin jogosultsag." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_device_assignments")
    .select(
      "id, admin_email, target_user_email, device_identifier, category, source_waitlist_id, assigned_at",
    )
    .order("assigned_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, items: data ?? [] });
}
