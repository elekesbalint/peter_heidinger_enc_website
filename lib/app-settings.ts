import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import { getTopupBlockSmallestCategoriesFromString } from "@/lib/topup-calculations";

const DEFAULTS: Record<string, string> = {
  min_balance_warning_huf: "5000",
  topup_discount_percent: "0",
  fx_eur_to_huf: "400",
  topup_package_1_huf: "40",
  topup_package_2_huf: "60",
  topup_package_3_huf: "100",
  /** Vesszovel elvalasztott kategoriak (pl. ii,iii,iv): ezekhez nem valaszthato a legkisebb topup csomag. */
  topup_block_smallest_for_categories: "ii,iii,iv",
  referral_device_discount_huf: "25000",
};

export async function getSettingsMap(): Promise<Record<string, string>> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("settings").select("key, value");
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of data ?? []) {
    if (row.key && row.value != null) {
      map[row.key] = String(row.value);
    }
  }
  return map;
}

export function getIntSetting(map: Record<string, string>, key: string, fallback: number): number {
  const v = map[key];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function getTopupPackagesFromSettings(map: Record<string, string>): number[] {
  const a = getIntSetting(map, "topup_package_1_huf", 40);
  const b = getIntSetting(map, "topup_package_2_huf", 60);
  const c = getIntSetting(map, "topup_package_3_huf", 100);
  return Array.from(new Set([a, b, c])).sort((x, y) => x - y);
}

export {
  applyTopupDiscount,
  isSmallestTopupPackage,
  isTopupPackageBlockedForCategory,
} from "@/lib/topup-calculations";

/** Kategoriak, amelyeknel a legkisebb (1.) csomag nem valaszthato. */
export function getTopupBlockSmallestCategories(map: Record<string, string>): Set<string> {
  return getTopupBlockSmallestCategoriesFromString(
    map.topup_block_smallest_for_categories ?? DEFAULTS.topup_block_smallest_for_categories,
  );
}
