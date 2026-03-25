import Link from "next/link";

export default function AdatvedelemPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Főoldal
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Adatvédelmi tájékoztató</h1>
      <p className="mt-4 text-muted">
        Helyőrző. Illeszd be a GDPR / 2011. évi CXII. törvény szerinti teljes szöveget, illetve a cookie / marketing
        beállításokat.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Adatkezelő</h2>
          <p className="mt-2 text-muted">
            Adatkezelő megnevezése és elérhetősége — pótolni.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Kezelt adatkörök</h2>
          <p className="mt-2 text-muted">
            Fiók, rendelés, fizetés, üzenetek — pótolni.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Tárolási idő, jogalapok</h2>
          <p className="mt-2 text-muted">
            Részletes tárolási idő és jogalapok — pótolni.
          </p>
        </div>
      </div>
    </div>
  );
}
