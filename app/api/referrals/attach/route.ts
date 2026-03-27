import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    user_id?: string;
    email?: string;
  };

  const token = (body.token ?? "").trim();
  const userId = (body.user_id ?? "").trim();
  const email = normalizeEmail(body.email ?? "");
  if (!token || !userId || !email) {
    return Response.json({ ok: false, error: "Hiányzó token/user." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: invite, error: inviteErr } = await supabase
    .from("referral_invites")
    .select("id, invited_email, invited_auth_user_id, discount_used_at")
    .eq("token", token)
    .maybeSingle();

  if (inviteErr) {
    return Response.json({ ok: false, error: inviteErr.message }, { status: 500 });
  }
  if (!invite) {
    return Response.json({ ok: false, error: "Érvénytelen ajánló token." }, { status: 404 });
  }
  if (invite.discount_used_at) {
    return Response.json({ ok: false, error: "Az ajánló már fel lett használva." }, { status: 400 });
  }
  if (normalizeEmail(invite.invited_email ?? "") !== email) {
    return Response.json({ ok: false, error: "A token nem ehhez az e-mailhez tartozik." }, { status: 400 });
  }
  if (invite.invited_auth_user_id && invite.invited_auth_user_id !== userId) {
    return Response.json({ ok: false, error: "A token már másik userhez tartozik." }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("referral_invites")
    .update({
      invited_auth_user_id: userId,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (updErr) {
    return Response.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

