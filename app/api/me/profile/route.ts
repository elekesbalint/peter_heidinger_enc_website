import { getCurrentUser } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("auth_user_id, user_type, name, phone, billing_address, shipping_address, updated_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    profile: data ?? {
      auth_user_id: user.id,
      user_type: "private",
      name: null,
      phone: null,
      billing_address: null,
      shipping_address: null,
      updated_at: null,
    },
    email: user.email ?? null,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }

  const body = (await request.json()) as {
    user_type?: string;
    name?: string | null;
    phone?: string | null;
    billing_address?: string | null;
    shipping_address?: string | null;
  };

  const patch: Record<string, string | null> = {
    auth_user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (body.user_type !== undefined) {
    const t = String(body.user_type).toLowerCase();
    if (t !== "private" && t !== "company") {
      return Response.json({ ok: false, error: "user_type: private vagy company." }, { status: 400 });
    }
    patch.user_type = t;
  }
  if (body.name !== undefined) patch.name = body.name === null ? null : String(body.name).trim() || null;
  if (body.phone !== undefined) patch.phone = body.phone === null ? null : String(body.phone).trim() || null;
  if (body.billing_address !== undefined) {
    patch.billing_address =
      body.billing_address === null ? null : String(body.billing_address).trim() || null;
  }
  if (body.shipping_address !== undefined) {
    patch.shipping_address =
      body.shipping_address === null ? null : String(body.shipping_address).trim() || null;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "auth_user_id" });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
