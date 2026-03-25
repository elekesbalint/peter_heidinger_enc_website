import Link from "next/link";

export default function TopupCancelPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-warning-light text-3xl">
          ✕
        </div>
        <h1 className="text-2xl font-bold text-foreground">Fizetés megszakítva</h1>
        <p className="mt-3 text-muted">
          A fizetést megszakítottad, nem történt terhelés.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/topup"
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
          >
            Vissza a feltöltéshez
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
