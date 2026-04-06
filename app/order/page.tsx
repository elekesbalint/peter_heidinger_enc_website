import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import type { DeviceCategoryValue } from "@/lib/device-categories";
import { getDevicePriceHuf } from "@/lib/device-categories";
import { isProfileComplete } from "@/lib/profile-completion";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { OrderForm } from "./order-form";

export default async function OrderPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!(await isProfileComplete(user.id))) {
    redirect("/dashboard?profile=required");
  }

  const settings = await getSettingsMap();
  const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));
  const price = Math.max(
    1,
    getIntSetting(settings, "device_price_huf", getDevicePriceHuf()),
  );
  const referralWalletBonusCapHuf = Math.max(
    0,
    getIntSetting(settings, "referral_device_discount_huf", 25000),
  );
  const supabase = createSupabaseAdminClient();
  const { data: activeReferral } = await supabase
    .from("referral_invites")
    .select("id")
    .eq("invited_auth_user_id", user.id)
    .is("discount_used_at", null)
    .order("accepted_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const referralWalletBonusHuf = activeReferral ? Math.min(price, referralWalletBonusCapHuf) : 0;
  const referralWalletBonusEur = Number((referralWalletBonusHuf / fxEurToHuf).toFixed(2));
  const categoryGuideTitle =
    settings.order_category_guide_title?.trim() || "Kategória magyarázó";
  const categoryGuideSubtitle =
    settings.order_category_guide_subtitle?.trim() ||
    "Válaszd ki a kategóriát, és ellenőrizd a fő szempontokat.";
  const categoryGuideItems: Record<DeviceCategoryValue, string> = {
    ia:
      settings.order_category_guide_ia_items?.trim() ||
      "Motorkerékpár\n2 tengely\nAlacsonyabb járműmagasság",
    i:
      settings.order_category_guide_i_items?.trim() ||
      "Személyautó\nKisbusz\n2 tengely, lakókocsi/pótkocsi nélkül",
    ii:
      settings.order_category_guide_ii_items?.trim() ||
      "Kisteherautó\n2 tengely, magasabb felépítmény\nNagyobb össztömeg vagy méret",
    iii:
      settings.order_category_guide_iii_items?.trim() ||
      "Busz\n3 tengely\nNagyobb járműkategória",
    iv:
      settings.order_category_guide_iv_items?.trim() ||
      "Nehézteherautó\n4 vagy több tengely\nLegmagasabb díjkategória",
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl px-6 py-12">
      <span className="adria-page-glow adria-page-glow-a" aria-hidden />
      <span className="adria-page-glow adria-page-glow-b" aria-hidden />
      <div className="relative z-10">
        <Link
          href="/dashboard"
          className="adria-animate-in inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:underline"
        >
          ← Vissza a fiókomba
        </Link>
        <h1 className="adria-animate-in adria-delay-1 mt-6 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          ENC készülék megrendelése
        </h1>
        <p className="adria-animate-in adria-delay-2 mt-3 text-base leading-relaxed text-muted">
          Válaszd ki a járműkategóriát, add meg a rendszámodat, fogadd el a feltételeket, majd fizess biztonságosan a Stripe
          Checkout-on keresztül.
        </p>
        <div className="adria-animate-in adria-delay-3 mt-4 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-white/60 px-4 py-2.5 text-sm font-medium text-primary shadow-sm backdrop-blur-sm">
          <span>Aktuális készülékár:</span>
          <span className="font-bold tabular-nums">{price.toLocaleString("hu-HU")} Ft</span>
        </div>
        {referralWalletBonusHuf > 0 && (
          <div className="adria-animate-in adria-delay-4 mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p>
              Ajánlói juttatás: első készülékvásárlásod után{" "}
              <strong>{referralWalletBonusEur.toLocaleString("hu-HU")} EUR</strong> induló egyenleg kerül a készülékhez
              (útdíj / feltöltés a fiókban).
            </p>
            <p className="mt-1">
              A készülék teljes ára: <strong>{price.toLocaleString("hu-HU")} Ft</strong> — a Stripe-ban is ezt fizeted.
            </p>
          </div>
        )}
        <OrderForm
          categoryGuideTitle={categoryGuideTitle}
          categoryGuideSubtitle={categoryGuideSubtitle}
          categoryGuideItems={categoryGuideItems}
        />
      </div>
    </div>
  );
}
