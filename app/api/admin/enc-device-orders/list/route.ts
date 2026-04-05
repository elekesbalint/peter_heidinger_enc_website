import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const ALLOWED_PER_PAGE = new Set([10, 100, 200]);

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

  if (searchParams.get("activeTotal") === "1") {
    const { count, error: countErr } = await supabase
      .from("enc_device_orders")
      .select("*", { count: "exact", head: true })
      .is("archived_at", null)
      .is("cancelled_at", null)
      .is("shipped_at", null);
    if (countErr) {
      return Response.json({ ok: false, error: countErr.message }, { status: 500 });
    }
    return Response.json({ ok: true, activeTotal: count ?? 0 });
  }

  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPageRaw = Number.parseInt(searchParams.get("perPage") ?? "10", 10) || 10;
  const perPage = ALLOWED_PER_PAGE.has(perPageRaw) ? perPageRaw : 10;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await supabase
    .from("enc_device_orders")
    .select(
      "id, stripe_session_id, auth_user_id, user_email, device_identifier, category, amount_huf, status, assignment_ok, paid_at, created_at, archived_at, cancelled_at, shipped_at, tracking_number",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items = data ?? [];
  const authIds = Array.from(
    new Set(items.map((r) => r.auth_user_id).filter((v): v is string => typeof v === "string" && v.trim().length > 0)),
  );

  let byAuthId = new Map<string, { billing_address: string | null; shipping_address: string | null }>();
  if (authIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("auth_user_id, billing_address, shipping_address")
      .in("auth_user_id", authIds);
    if (profileErr) {
      return Response.json({ ok: false, error: profileErr.message }, { status: 500 });
    }
    byAuthId = new Map(
      (profiles ?? []).map((p) => [
        p.auth_user_id,
        { billing_address: p.billing_address ?? null, shipping_address: p.shipping_address ?? null },
      ]),
    );
  }

  const merged = items.map((r) => {
    const profile = byAuthId.get(r.auth_user_id ?? "");
    return {
      ...r,
      billing_address: profile?.billing_address ?? null,
      shipping_address: profile?.shipping_address ?? null,
    };
  });

  return Response.json({
    ok: true,
    items: merged,
    total: count ?? 0,
    page,
    perPage,
  });
}
