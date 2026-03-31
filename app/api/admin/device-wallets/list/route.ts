import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const supabase = createSupabaseAdminClient();

  const settings = await getSettingsMap();
  const minBalanceWarningHuf = getIntSetting(settings, "min_balance_warning_huf", 5000);
  const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));

  const { data: devices, error: devErr } = await supabase
    .from("devices")
    .select("identifier, status, category, updated_at")
    .limit(500);

  if (devErr) {
    return Response.json({ ok: false, error: devErr.message }, { status: 500 });
  }

  const filtered = (devices ?? []).filter((d) => (q ? d.identifier.toLowerCase().includes(q.toLowerCase()) : true));
  const identifiers = filtered.map((d) => d.identifier);

  let walletsById = new Map<string, { balance_huf: number; updated_at: string | null }>();
  if (identifiers.length > 0) {
    const { data: wallets, error: wErr } = await supabase
      .from("device_wallets")
      .select("device_identifier, balance_huf, updated_at")
      .in("device_identifier", identifiers);
    if (wErr) {
      return Response.json({ ok: false, error: wErr.message }, { status: 500 });
    }
    walletsById = new Map(
      (wallets ?? []).map((w) => [
        w.device_identifier as string,
        { balance_huf: Number(w.balance_huf), updated_at: w.updated_at ?? null },
      ]),
    );
  }

  const items = filtered.map((d) => {
    const w = walletsById.get(d.identifier);
    return {
      identifier: d.identifier,
      status: d.status,
      category: d.category,
      balance_huf: w?.balance_huf ?? null,
      updated_at: w?.updated_at ?? null,
    };
  });

  return Response.json({ ok: true, minBalanceWarningHuf, fxEurToHuf, items });
}

