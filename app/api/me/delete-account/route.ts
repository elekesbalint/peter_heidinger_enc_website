import { getCurrentUser } from "@/lib/auth-server";
import { deleteUserRelatedData } from "@/lib/account-deletion";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
    }

    const authUserId = user.id;
    const userEmail = (user.email ?? "").trim().toLowerCase();
    if (!userEmail) {
      return Response.json({ ok: false, error: "A felhasználóhoz nem tartozik e-mail cím." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    await deleteUserRelatedData(supabase, authUserId, userEmail);

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUserId);
    if (deleteAuthError) {
      return Response.json(
        { ok: false, error: `A fiók azonosító törlése sikertelen: ${deleteAuthError.message}` },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
