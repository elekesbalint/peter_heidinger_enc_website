import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
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
  const price = Math.max(
    1,
    getIntSetting(settings, "device_price_huf", getDevicePriceHuf()),
  );
  const referralDiscountHuf = Math.max(
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
  const appliedReferralDiscountHuf = activeReferral
    ? Math.min(price, referralDiscountHuf)
    : 0;
  const payablePriceHuf = Math.max(1, price - appliedReferralDiscountHuf);

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
        {appliedReferralDiscountHuf > 0 && (
          <div className="adria-animate-in adria-delay-4 mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p>
              Ajánlói kedvezmény alkalmazva:{" "}
              <strong>-{appliedReferralDiscountHuf.toLocaleString("hu-HU")} Ft</strong>
            </p>
            <p className="mt-1">
              Fizetendő összeg:{" "}
              <strong>{payablePriceHuf.toLocaleString("hu-HU")} Ft</strong>
            </p>
          </div>
        )}
        <OrderForm />
      </div>
    </div>
  );
}
