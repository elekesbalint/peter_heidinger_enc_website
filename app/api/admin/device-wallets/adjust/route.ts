import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin-guard";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function parseIntStrict(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return null;
    return n;
  }
  return null;
}

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json().catch(() => ({}))) as {
    device_identifier?: string;
    new_balance_huf?: number | string;
    reason?: string;
  };

  const deviceIdentifier = (body.device_identifier ?? "").trim();
  if (!deviceIdentifier) {
    return Response.json({ ok: false, error: "Hiányzó `device_identifier`." }, { status: 400 });
  }

  const newBalance = parseIntStrict(body.new_balance_huf);
  if (newBalance === null || newBalance < 0) {
    return Response.json(
      { ok: false, error: "Érvénytelen `new_balance_huf` (egész szám, 0 vagy nagyobb)." },
      { status: 400 },
    );
  }

  const reason = (body.reason ?? "").trim().slice(0, 80);
  const supabase = createSupabaseAdminClient();

  const { data: existingWallet, error: walletErr } = await supabase
    .from("device_wallets")
    .select("balance_huf, updated_at")
    .eq("device_identifier", deviceIdentifier)
    .maybeSingle();

  if (walletErr) {
    return Response.json({ ok: false, error: walletErr.message }, { status: 500 });
  }

  const oldBalance = existingWallet?.balance_huf ?? 0;
  const delta = newBalance - oldBalance;

  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await supabase.from("device_wallets").upsert(
    {
      device_identifier: deviceIdentifier,
      balance_huf: newBalance,
      updated_at: nowIso,
    },
    { onConflict: "device_identifier" },
  );

  if (upsertErr) {
    return Response.json({ ok: false, error: upsertErr.message }, { status: 500 });
  }

  // Audit: insert a wallet transaction only when balance actually changed.
  if (delta !== 0) {
    const safeReason = reason ? reason.replace(/\s+/g, "_") : "no_reason";
    const stripeSessionId = `manual:${randomUUID()}:${safeReason}`;

    const { error: txErr } = await supabase.from("wallet_transactions").insert({
      device_identifier: deviceIdentifier,
      amount_huf: delta,
      transaction_type: "manual_adjust",
      stripe_session_id: stripeSessionId,
      user_email: null,
      created_at: nowIso,
    });

    if (txErr) {
      return Response.json({ ok: false, error: txErr.message }, { status: 500 });
    }
  }

  const settings = await getSettingsMap();
  const minBalanceWarningHuf = getIntSetting(settings, "min_balance_warning_huf", 5000);
  const crossedLowBalance = oldBalance >= minBalanceWarningHuf && newBalance < minBalanceWarningHuf;
  if (crossedLowBalance) {
    const { data: deviceRow } = await supabase
      .from("devices")
      .select("auth_user_id")
      .eq("identifier", deviceIdentifier)
      .maybeSingle();

    const authUserId = deviceRow?.auth_user_id ?? null;
    if (authUserId) {
      const userResp = await supabase.auth.admin.getUserById(authUserId);
      const to = userResp.data.user?.email?.trim() ?? "";
      if (to) {
        await sendAppEmail({
          to,
          subject: "AdriaGo — alacsony egyenleg figyelmeztetés",
          text: `Az eszközöd (${deviceIdentifier}) egyenlege ${newBalance} Ft-ra változott, ami az alacsony egyenleg küszöb (${minBalanceWarningHuf} Ft) alatt van. Kérjük töltsd fel az egyenleget.`,
        }).catch((err) => {
          console.error("[wallet-adjust] low-balance email failed:", err);
        });
      }
    }
  }

  return Response.json({
    ok: true,
    device_identifier: deviceIdentifier,
    old_balance_huf: oldBalance,
    new_balance_huf: newBalance,
    delta_huf: delta,
  });
}

