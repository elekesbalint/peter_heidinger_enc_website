import Link from "next/link";
import { getSettingsMap } from "@/lib/app-settings";

export default async function AdatvedelemPage() {
  const settings = await getSettingsMap();
  const title = settings.adatvedelem_title?.trim() || "Adatvédelmi tájékoztató";
  const intro =
    settings.adatvedelem_intro?.trim() ||
    "Helyőrző. Illeszd be a GDPR / 2011. évi CXII. törvény szerinti teljes szöveget, illetve a cookie / marketing beállításokat.";
  const documentUrl = settings.adatvedelem_document_url?.trim() || "";
  const content =
    settings.adatvedelem_content?.trim() ||
    "Adatkezelő\nAdatkezelő megnevezése és elérhetősége — pótolni.\n\nKezelt adatkörök\nFiók, rendelés, fizetés, üzenetek — pótolni.\n\nTárolási idő, jogalapok\nRészletes tárolási idő és jogalapok — pótolni.";
  const blocks = content
    .split(/\n\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);
  const hasDocument = Boolean(documentUrl);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Főoldal
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
      {!hasDocument && <p className="mt-4 text-muted">{intro}</p>}
      {hasDocument && (
        <a
          href={documentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
        >
          Adatvédelmi dokumentum megnyitása / letöltése
        </a>
      )}
      {!hasDocument && (
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          {blocks.map((block, idx) => (
            <div key={`${idx}-${block.slice(0, 24)}`} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="whitespace-pre-wrap text-muted">{block}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
