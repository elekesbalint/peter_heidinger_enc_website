import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { getReferralWalletBonusCapEur } from "@/lib/referral-wallet-bonus";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type DeviceRow = {
  identifier: string;
  category: string;
  status: string;
  license_plate: string | null;
};

type WalletRow = {
  device_identifier: string;
  balance_huf: number;
};

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function GET(request: Request) {
  try {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return Response.json({ ok: false, error: "Missing bearer token." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return Response.json({ ok: false, error: "Invalid token." }, { status: 401 });
    }
    const user = authData.user;
    const userEmail = user.email ?? "";

    const settings = await getSettingsMap();
    const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));
    const referralWalletBonusCapEur = getReferralWalletBonusCapEur(settings, fxEurToHuf);
    const referralWalletBonusCapHuf = Math.round(referralWalletBonusCapEur * fxEurToHuf);
    const minBalanceWarningHuf = Math.max(0, getIntSetting(settings, "min_balance_warning_huf", 5000));
    const minBalanceWarningEur = Number((minBalanceWarningHuf / fxEurToHuf).toFixed(2));

    const [
      { data: profileRow },
      { data: devices, error: devicesError },
      { data: topups, error: topupsError },
      { data: orders, error: ordersError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase
        .from("devices")
        .select("identifier, category, status, license_plate")
        .eq("auth_user_id", user.id)
        .order("sold_at", { ascending: false }),
      supabase
        .from("stripe_topups")
        .select("id, amount_huf, currency, status, paid_at, device_identifier, travel_destination")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("enc_device_orders")
        .select("id, device_identifier, status, paid_at, amount_huf, category, created_at")
        .eq("auth_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (devicesError) {
      return Response.json({ ok: false, error: devicesError.message }, { status: 500 });
    }
    if (topupsError) {
      return Response.json({ ok: false, error: topupsError.message }, { status: 500 });
    }
    if (ordersError) {
      return Response.json({ ok: false, error: ordersError.message }, { status: 500 });
    }

    const identifiers = (devices ?? []).map((d) => d.identifier);
    type WalletRowFull = WalletRow & { updated_at?: string };
    const { data: wallets, error: walletsError } = identifiers.length
      ? await supabase
          .from("device_wallets")
          .select("device_identifier, balance_huf, updated_at")
          .in("device_identifier", identifiers)
      : { data: [] as WalletRowFull[], error: null };
    if (walletsError) {
      return Response.json({ ok: false, error: walletsError.message }, { status: 500 });
    }

    const { data: invites, error: invitesError } = await supabase
      .from("referral_invites")
      .select("id, invited_email, status, created_at, accepted_at, discount_used_at")
      .eq("inviter_auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (invitesError) {
      return Response.json({ ok: false, error: invitesError.message }, { status: 500 });
    }

    const walletByIdentifier = new Map(
      (wallets ?? []).map((w) => [w.device_identifier, Number(w.balance_huf ?? 0)] as const),
    );

    const rawName = (profileRow as { name?: string | null } | null)?.name ?? "";
    const displayName = rawName.trim() || userEmail.split("@")[0] || "Felhasználó";
    const avatarUrl = (profileRow as { avatar_url?: string | null } | null)?.avatar_url ?? null;

    return Response.json({
      ok: true,
      fxEurToHuf,
      referralWalletBonusCapEur,
      referralWalletBonusCapHuf,
      minBalanceWarningEur,
      displayName,
      avatarUrl,
      devices: (devices ?? []).map((d: DeviceRow) => ({
        identifier: d.identifier,
        category: d.category,
        status: d.status,
        licensePlate: d.license_plate,
        balanceHuf: walletByIdentifier.get(d.identifier) ?? 0,
      })),
      wallets: (wallets ?? []).map((w) => ({
        deviceIdentifier: w.device_identifier,
        balanceHuf: Number(w.balance_huf ?? 0),
        updatedAt: w.updated_at ?? null,
      })),
      orders: (orders ?? []).map((o) => ({
        id: o.id,
        deviceIdentifier: o.device_identifier,
        status: o.status,
        paidAt: o.paid_at,
        amountHuf: o.amount_huf != null ? Number(o.amount_huf) : null,
        category: o.category,
        createdAt: o.created_at,
      })),
      topups: (topups ?? []).map((t) => ({
        id: t.id,
        amountHuf: Number(t.amount_huf ?? 0),
        currency: String(t.currency ?? "HUF").toUpperCase(),
        status: t.status,
        paidAt: t.paid_at,
        deviceIdentifier: t.device_identifier,
        travelDestination: t.travel_destination,
      })),
      invites: invites ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

