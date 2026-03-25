import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sessionId = resolvedSearchParams.session_id;

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-3xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-success">Köszönjük a vásárlást!</h1>
        <p className="mt-3 text-muted">
          A fizetés sikeres volt. A készülék hozzárendelését a rendszer automatikusan feldolgozza — néhány
          másodperc múva láthatod a fiókodban.
        </p>
        {sessionId && (
          <p className="mt-2 font-mono text-xs text-slate-400">Munkamenet: {sessionId}</p>
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
