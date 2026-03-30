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

  const profileByUser = new Map<
    string,
    {
      name: string | null;
      phone: string | null;
      billing_address: string | null;
      shipping_address: string | null;
    }
  >();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("auth_user_id, name, phone, billing_address, shipping_address")
      .in("auth_user_id", ids);
    for (const p of profiles ?? []) {
      profileByUser.set(p.auth_user_id, {
        name: p.name,
        phone: p.phone,
        billing_address: p.billing_address ?? null,
        shipping_address: p.shipping_address ?? null,
      });
    }
  }

  const devicesByUser = new Map<
    string,
    Array<{
      identifier: string;
      category: string;
      status: string;
      balance_huf: number | null;
    }>
  >();
  if (ids.length > 0) {
    const { data: devices } = await supabase
      .from("devices")
      .select("auth_user_id, identifier, category, status")
      .in("auth_user_id", ids);
    const identifiers = (devices ?? []).map((d) => d.identifier);
    const walletByIdentifier = new Map<string, number>();
    if (identifiers.length > 0) {
      const { data: wallets } = await supabase
        .from("device_wallets")
        .select("device_identifier, balance_huf")
        .in("device_identifier", identifiers);
      for (const w of wallets ?? []) {
        walletByIdentifier.set(w.device_identifier, Number(w.balance_huf ?? 0));
      }
    }
    for (const d of devices ?? []) {
      if (!d.auth_user_id) continue;
      const list = devicesByUser.get(d.auth_user_id) ?? [];
      list.push({
        identifier: d.identifier,
        category: d.category,
        status: d.status,
        balance_huf: walletByIdentifier.has(d.identifier) ? walletByIdentifier.get(d.identifier)! : null,
      });
      devicesByUser.set(d.auth_user_id, list);
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
      billing_address: pr?.billing_address ?? null,
      shipping_address: pr?.shipping_address ?? null,
      devices: devicesByUser.get(u.id) ?? [],
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
