import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { isProfileComplete } from "@/lib/profile-completion";
import { TopupClient } from "./topup-client";

export default async function TopupPage({
  searchParams,
}: {
  searchParams?: Promise<{ device?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!(await isProfileComplete(user.id))) {
    redirect("/dashboard?profile=required");
  }

  const params = searchParams ? await searchParams : undefined;
  const initialDeviceIdentifier = (params?.device ?? "").trim();

  return (
    <div className="relative mx-auto w-full max-w-4xl px-6 py-12">
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
          Egyenlegfeltöltés
        </h1>
        <p className="adria-animate-in adria-delay-2 mt-3 text-base leading-relaxed text-muted">
          Válaszd ki a készülékedet, az úticélt és a feltöltési csomagot, majd fizess Stripe-on keresztül.
        </p>
        <p className="adria-animate-in adria-delay-2 mt-2 text-sm text-slate-500">
          Bejelentkezve: <span className="font-medium text-slate-700">{user.email}</span>
        </p>

        <TopupClient initialDeviceIdentifier={initialDeviceIdentifier} />
      </div>
    </div>
  );
}
