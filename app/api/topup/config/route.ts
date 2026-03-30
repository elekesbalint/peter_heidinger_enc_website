import {
  getIntSetting,
  getSettingsMap,
  getTopupBlockSmallestCategories,
  getTopupPackagesFromSettings,
  isTopupPackageBlockedForCategory,
} from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
    }

    const settings = await getSettingsMap();
    const packages = getTopupPackagesFromSettings(settings);
    const discountPercent = getIntSetting(settings, "topup_discount_percent", 0);
    const minBalanceWarningHuf = getIntSetting(settings, "min_balance_warning_huf", 5000);
    const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));
    const minBalanceWarningEur = Number((minBalanceWarningHuf / fxEurToHuf).toFixed(2));
    const blockedCategories = Array.from(getTopupBlockSmallestCategories(settings));

    const supabase = createSupabaseAdminClient();

    const [{ data: devices, error: devErr }, { data: destinations, error: destErr }] =
      await Promise.all([
        supabase
          .from("devices")
          .select("id, identifier, category, status")
          .eq("auth_user_id", user.id)
          .order("identifier", { ascending: true }),
        supabase
          .from("destinations")
          .select("id, name, price_ia, price_i, price_ii, price_iii, price_iv")
          .order("name", { ascending: true }),
      ]);

    if (devErr) {
      return Response.json({ ok: false, error: devErr.message }, { status: 500 });
    }
    if (destErr) {
      return Response.json({ ok: false, error: destErr.message }, { status: 500 });
    }

    const blocked = getTopupBlockSmallestCategories(settings);
    const identifiers = (devices ?? []).map((d) => d.identifier).filter(Boolean);
    let walletByIdentifier = new Map<string, number>();
    if (identifiers.length > 0) {
      const { data: wallets, error: walletErr } = await supabase
        .from("device_wallets")
        .select("device_identifier, balance_huf")
        .in("device_identifier", identifiers);
      if (walletErr) {
        return Response.json({ ok: false, error: walletErr.message }, { status: 500 });
      }
      walletByIdentifier = new Map(
        (wallets ?? []).map((w) => [w.device_identifier, Number(w.balance_huf ?? 0)] as const),
      );
    }

    const devicesOut = (devices ?? []).map((d) => {
      const cat = (d.category as string) ?? "";
      const smallest = packages[0];
      return {
        id: d.id,
        identifier: d.identifier,
        category: cat,
        status: d.status,
        balance_eur: Number((((walletByIdentifier.get(d.identifier) ?? 0) as number) / fxEurToHuf).toFixed(2)),
        smallestPackageBlocked:
          smallest != null &&
          isTopupPackageBlockedForCategory(cat, smallest, packages, blocked),
      };
    });

    return Response.json({
      ok: true,
      packages,
      discountPercent,
      minBalanceWarningEur,
      fxEurToHuf,
      blockedCategoriesForSmallestPackage: blockedCategories,
      devices: devicesOut,
      destinations: (destinations ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        price_ia: Number(r.price_ia ?? 0),
        price_i: Number(r.price_i ?? 0),
        price_ii: Number(r.price_ii ?? 0),
        price_iii: Number(r.price_iii ?? 0),
        price_iv: Number(r.price_iv ?? 0),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
