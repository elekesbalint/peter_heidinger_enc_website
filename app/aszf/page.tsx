import Link from "next/link";
import { getSettingsMap } from "@/lib/app-settings";
import { LegalDocument } from "@/components/legal-document";

export default async function AszfPage() {
  const settings = await getSettingsMap();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Főoldal
      </Link>
      <div className="mt-6">
        <LegalDocument
          title={settings.aszf_title?.trim() || "Általános Szerződési Feltételek"}
          label={settings.aszf_label?.trim() || "Jogi dokumentum"}
          lastUpdated={settings.aszf_last_updated?.trim() || ""}
          intro={
            settings.aszf_intro?.trim() ||
            "Ez egy helyőrző oldal. Az első valódi jogi szöveget cseréld le a Google Docs / ügyvédi dokumentum alapján."
          }
          content={
            settings.aszf_content?.trim() ||
            "1. A szolgáltatás tárgya\n\n1.1. ENC eszközök értékesítése, egyenlegfeltöltés, útdíj levonás — részletes leírás szükséges.\n\n2. Fizetés és szállítás\n\n2.1. Barion fizetési szolgáltatáson keresztül lehetséges a vásárlás.\n\n2.2. Szállítási feltételek — pótolni.\n\n3. Panaszkezelés és visszavonás\n\n3.1. Panaszkezelési eljárás, elállási jog — pótolni."
          }
          documentUrl={settings.aszf_document_url?.trim() || ""}
          documentLabel="ÁSZF dokumentum megnyitása / letöltése"
        />
      </div>
    </div>
  );
}
