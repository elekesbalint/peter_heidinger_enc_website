import Link from "next/link";

export default function AszfPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Főoldal
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Általános Szerződési Feltételek</h1>
      <p className="mt-4 text-muted">
        Ez egy helyőrző oldal. Az első valódi jogi szöveget cseréld le a Google Docs / ügyvédi dokumentum alapján.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">1. Szolgáltatás</h2>
          <p className="mt-2 text-muted">
            ENC eszköz értékesítés, egyenlegfeltöltés, útdíj levonás — részletes leírás szükséges.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">2. Fizetés és szállítás</h2>
          <p className="mt-2 text-muted">
            Stripe fizetés; szállítási és garanciális feltételek — pótolni.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">3. Panaszkezelés és visszavonás</h2>
          <p className="mt-2 text-muted">
            Panaszkezelési eljárás, elállás — pótolni.
          </p>
        </div>
      </div>
    </div>
  );
}
