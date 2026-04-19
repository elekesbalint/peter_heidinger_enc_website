import Link from "next/link";
import { redirect } from "next/navigation";

import {
  evaluateBarionReturn,
  firstSearchParam,
  isBarionReturnQuery,
  pickBarionPaymentIdFromSearchParams,
} from "@/lib/barion-return-outcome";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paymentId = pickBarionPaymentIdFromSearchParams(sp);
  const sessionId = firstSearchParam(sp, "session_id");
  const fromBarion = isBarionReturnQuery(sp);

  if (paymentId) {
    const outcome = await evaluateBarionReturn(paymentId);
    if (outcome.kind === "not_completed") {
      redirect("/order/cancel");
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
              Ha a Barion felületén sikeresnek láttad a fizetést, a rendszer néhány perc alatt feldolgozhatja —
              nézd meg a fiókod.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/order"
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
              >
                Rendelés
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
    redirect("/order/cancel");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-3xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-success">Köszönjük a vásárlást!</h1>
        <p className="mt-3 text-muted">
          A fizetés sikeres volt. A készülék hozzárendelését a rendszer automatikusan feldolgozza — néhány
          másodperc múlva láthatod a fiókodban.
        </p>
        {sessionId && (
          <p className="mt-2 font-mono text-xs text-slate-400">Munkamenet: {sessionId}</p>
        )}
        {paymentId && (
          <p className="mt-2 font-mono text-xs text-slate-400">Barion fizetés: {paymentId}</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
          >
            Fiókom
          </Link>
          <Link
            href="/order"
            className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50"
          >
            Újabb rendelés
          </Link>
        </div>
      </div>
    </div>
  );
}
