import { requireAdmin } from "@/lib/admin-guard";
import { deleteUserRelatedData } from "@/lib/account-deletion";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = (body.id ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, error: "Hiányzó user azonosító." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(id);
  if (authUserError || !authUserData?.user) {
    return Response.json({ ok: false, error: authUserError?.message ?? "Felhasználó nem található." }, { status: 404 });
  }

  const targetEmail = (authUserData.user.email ?? "").trim().toLowerCase();
  if (!targetEmail) {
    return Response.json({ ok: false, error: "A törlendő felhasználónak nincs e-mail címe." }, { status: 400 });
  }

  if (g.email && targetEmail === g.email.trim().toLowerCase()) {
    return Response.json({ ok: false, error: "Saját admin fiók itt nem törölhető." }, { status: 400 });
  }

  try {
    await deleteUserRelatedData(supabase, id, targetEmail);

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
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
