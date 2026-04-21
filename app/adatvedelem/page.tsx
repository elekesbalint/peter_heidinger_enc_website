import Link from "next/link";
import { getSettingsMap } from "@/lib/app-settings";
import { LegalDocument } from "@/components/legal-document";

export default async function AdatvedelemPage() {
  const settings = await getSettingsMap();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Főoldal
      </Link>
      <div className="mt-6">
        <LegalDocument
          title={settings.adatvedelem_title?.trim() || "Adatvédelmi tájékoztató"}
          label={settings.adatvedelem_label?.trim() || "Jogi dokumentum"}
          lastUpdated={settings.adatvedelem_last_updated?.trim() || ""}
          intro={
            settings.adatvedelem_intro?.trim() ||
            "Helyőrző. Illeszd be a GDPR / 2011. évi CXII. törvény szerinti teljes szöveget."
          }
          content={
            settings.adatvedelem_content?.trim() ||
            "## Adatkezelő\n\nAdatkezelő megnevezése és elérhetősége — pótolni.\n\n## Kezelt adatkörök\n\nFiók, rendelés, fizetés, üzenetek — pótolni.\n\n## Tárolási idő, jogalapok\n\nRészletes tárolási idő és jogalapok — pótolni."
          }
          documentUrl={settings.adatvedelem_document_url?.trim() || ""}
          documentLabel="Adatvédelmi dokumentum megnyitása / letöltése"
        />
      </div>
    </div>
  );
}
