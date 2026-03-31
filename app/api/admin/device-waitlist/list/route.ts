import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { releaseExpiredDeviceReservations } from "@/lib/device-waitlist-reservations";
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
  try {
    await releaseExpiredDeviceReservations();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nem sikerült a lejárt rezervációk felszabadítása.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
  const { data, error } = await supabase
    .from("device_waitlist")
    .select("id, auth_user_id, user_email, category, note, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, items: data ?? [] });
}
