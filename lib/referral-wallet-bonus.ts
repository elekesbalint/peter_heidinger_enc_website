import { getIntSetting } from "@/lib/app-settings";

/**
 * Ajánlói induló egyenleg plafonja EUR-ban (a wallet felületén is EUR jelenik meg).
 *
 * Elsődleges kulcs: `referral_wallet_bonus_cap_eur` (adminban állítható).
 * Ha ez üres / hiányzik: `referral_device_discount_huf` / árfolyam (régi név, Ft-os tartalék).
 */
export function getReferralWalletBonusCapEur(
  settings: Record<string, string>,
  fxEurToHuf: number,
): number {
  const fx = Math.max(1, fxEurToHuf);
  const raw = settings.referral_wallet_bonus_cap_eur;
  if (raw != null && String(raw).trim() !== "") {
    const n = Number.parseFloat(String(raw).replace(",", "."));
    if (Number.isFinite(n)) {
      return Math.max(0, n);
    }
  }
  const legacyHuf = Math.max(0, getIntSetting(settings, "referral_device_discount_huf", 25000));
  return legacyHuf / fx;
}

/** Barion meta / apply_topup továbbra is egész Ft-ot kap; a számítást EUR plafon alapján végezzük. */
export function computeReferralWalletBonusHuf(opts: {
  basePriceHuf: number;
  fxEurToHuf: number;
  hasActiveReferral: boolean;
  settings: Record<string, string>;
}): number {
  const fx = Math.max(1, opts.fxEurToHuf);
  const capEur = getReferralWalletBonusCapEur(opts.settings, fx);
  if (!opts.hasActiveReferral || capEur <= 0) return 0;
  const baseEur = opts.basePriceHuf / fx;
  const bonusEur = Math.min(baseEur, capEur);
  return Math.round(bonusEur * fx);
}

export function computeReferralWalletBonusForDisplay(opts: {
  basePriceHuf: number;
  fxEurToHuf: number;
  hasActiveReferral: boolean;
  settings: Record<string, string>;
}): { bonusEur: number; bonusHuf: number; capEur: number } {
  const fx = Math.max(1, opts.fxEurToHuf);
  const capEur = getReferralWalletBonusCapEur(opts.settings, fx);
  const bonusHuf = computeReferralWalletBonusHuf(opts);
  const bonusEur = bonusHuf > 0 ? Number((bonusHuf / fx).toFixed(2)) : 0;
  return { bonusEur, bonusHuf, capEur };
}
