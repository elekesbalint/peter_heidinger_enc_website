/** Csak tiszta szamitasok — hasznalhato kliensen es szerveren (nincs Supabase). */

export function applyTopupDiscount(baseAmount: number, discountPercent: number): number {
  if (discountPercent <= 0) return baseAmount;
  const p = Math.min(100, Math.max(0, discountPercent));
  const discounted = (baseAmount * (100 - p)) / 100;
  return Math.max(0.01, Math.round(discounted * 100) / 100);
}

export function isSmallestTopupPackage(baseHuf: number, packagesSorted: number[]): boolean {
  if (packagesSorted.length === 0) return false;
  return baseHuf === packagesSorted[0];
}

export function getTopupBlockSmallestCategoriesFromString(raw: string): Set<string> {
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(parts);
}

export function isTopupPackageBlockedForCategory(
  deviceCategory: string | null | undefined,
  baseHuf: number,
  packagesSorted: number[],
  blockedCategories: Set<string>,
): boolean {
  const cat = (deviceCategory ?? "").trim().toLowerCase();
  if (!cat || !blockedCategories.has(cat)) return false;
  return isSmallestTopupPackage(baseHuf, packagesSorted);
}
