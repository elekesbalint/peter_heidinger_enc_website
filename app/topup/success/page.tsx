import Link from "next/link";
import { redirect } from "next/navigation";

import {
  evaluateBarionReturn,
  isBarionReturnQuery,
  pickBarionPaymentIdFromSearchParams,
} from "@/lib/barion-return-outcome";

export const dynamic = "force-dynamic";

export default async function TopupSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paymentId = pickBarionPaymentIdFromSearchParams(sp);
  const fromBarion = isBarionReturnQuery(sp);

  if (paymentId) {
    const outcome = await evaluateBarionReturn(paymentId);
    if (outcome.kind === "not_completed") {
      redirect("/topup/cancel");
    }
    if (outcome.kind === "verify_error") {
      return (
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
              !
            </div>
            <h1 className="text-2xl font-bold text-foreground">Nem sikerült ellenőrizni a fizetést</h1>
            <p className="mt-3 text-muted">{outcome.message}</p>
            <p className="mt-3 text-sm text-muted">
              Ha a Barion felületén sikeresnek láttad a fizetést, az egyenleg néhány perc alatt frissülhet —
              nézd meg a fiókod.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/topup"
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
              >
                Újra feltöltés
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50"
              >
                Fiókom
              </Link>
            </div>
          </div>
        </div>
      );
    }
  } else if (fromBarion) {
    redirect("/topup/cancel");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-3xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-success">Sikeres feltöltés!</h1>
        <p className="mt-3 text-muted">
          A fizetés sikeres volt. A tranzakciót a rendszer feldolgozza és az egyenleged frissül.
        </p>
        {paymentId && (
          <p className="mt-2 font-mono text-xs text-slate-400">Barion fizetés: {paymentId}</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/topup"
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
          >
            Új feltöltés
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50"
          >
            Fiókom
          </Link>
        </div>
      </div>
    </div>
  );
}
