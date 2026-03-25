import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { getDevicePriceHuf } from "@/lib/device-categories";
import { isProfileComplete } from "@/lib/profile-completion";
import { OrderForm } from "./order-form";

export default async function OrderPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!(await isProfileComplete(user.id))) {
    redirect("/dashboard?profile=required");
  }

  const price = getDevicePriceHuf();

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
        <OrderForm />
      </div>
    </div>
  );
}
