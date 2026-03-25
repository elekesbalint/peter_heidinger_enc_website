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
    const blockedCategories = Array.from(getTopupBlockSmallestCategories(settings));

    const supabase = createSupabaseAdminClient();

    const [{ data: devices, error: devErr }, { data: destinations, error: destErr }] =
      await Promise.all([
        supabase
          .from("devices")
          .select("id, identifier, category, status")
          .eq("auth_user_id", user.id)
          .order("identifier", { ascending: true }),
        supabase.from("destinations").select("id, name").order("name", { ascending: true }),
      ]);

    if (devErr) {
      return Response.json({ ok: false, error: devErr.message }, { status: 500 });
    }
    if (destErr) {
      return Response.json({ ok: false, error: destErr.message }, { status: 500 });
    }

    const blocked = getTopupBlockSmallestCategories(settings);
    const devicesOut = (devices ?? []).map((d) => {
      const cat = (d.category as string) ?? "";
      const smallest = packages[0];
      return {
        id: d.id,
        identifier: d.identifier,
        category: cat,
        status: d.status,
        smallestPackageBlocked:
          smallest != null &&
          isTopupPackageBlockedForCategory(cat, smallest, packages, blocked),
      };
    });

    return Response.json({
      ok: true,
      packages,
      discountPercent,
      minBalanceWarningHuf,
      blockedCategoriesForSmallestPackage: blockedCategories,
      devices: devicesOut,
      destinations: (destinations ?? []).map((r) => ({ id: r.id, name: r.name })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
