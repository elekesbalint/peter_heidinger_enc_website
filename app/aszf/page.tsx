import Link from "next/link";
import { getSettingsMap } from "@/lib/app-settings";

export default async function AszfPage() {
  const settings = await getSettingsMap();
  const title = settings.aszf_title?.trim() || "Általános Szerződési Feltételek";
  const intro =
    settings.aszf_intro?.trim() ||
    "Ez egy helyőrző oldal. Az első valódi jogi szöveget cseréld le a Google Docs / ügyvédi dokumentum alapján.";
  const documentUrl = settings.aszf_document_url?.trim() || "";
  const content =
    settings.aszf_content?.trim() ||
    "1. Szolgáltatás\nENC eszköz értékesítés, egyenlegfeltöltés, útdíj levonás — részletes leírás szükséges.\n\n2. Fizetés és szállítás\nStripe fizetés; szállítási és garanciális feltételek — pótolni.\n\n3. Panaszkezelés és visszavonás\nPanaszkezelési eljárás, elállás — pótolni.";
  const blocks = content
    .split(/\n\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Főoldal
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 text-muted">{intro}</p>
      {documentUrl && (
        <a
          href={documentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
        >
          ÁSZF dokumentum megnyitása / letöltése
        </a>
      )}
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        {blocks.map((block, idx) => (
          <div key={`${idx}-${block.slice(0, 24)}`} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="whitespace-pre-wrap text-muted">{block}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
