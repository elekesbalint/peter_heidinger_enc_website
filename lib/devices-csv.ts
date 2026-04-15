import { parse } from "csv-parse/sync";

export type DeviceCategory = "ia" | "i" | "ii" | "iii" | "iv";

export type DeviceCsvRow = {
  identifier: string;
  category: DeviceCategory;
  sourceLineNumber: number;
};

const DELIMITER = ";";

function normalizeKey(input: string): string {
  return input
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function mapCategory(value: string): DeviceCategory | null {
  const v = normalizeKey(value).replaceAll(".", "");
  if (v === "ia" || v === "motor") return "ia";
  if (v === "i" || v === "szemelyauto") return "i";
  if (v === "ii") return "ii";
  if (v === "iii") return "iii";
  if (v === "iv") return "iv";
  return null;
}

function pickField(record: Record<string, string>, aliases: string[]): string {
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (aliases.includes(normalized)) return (value ?? "").trim();
  }
  return "";
}

export type ParseDevicesCsvOptions = {
  /** Ha meg van adva, ezt a kategóriát alkalmazza minden sorra (CSV kategória mező opcionális lesz). */
  categoryOverride?: DeviceCategory;
};

/**
 * CSV beolvasása.
 * - Ha `categoryOverride` meg van adva: elég egy oszlop az azonosítóknak (nincs szükség kategória oszlopra).
 * - Ha nincs override: a CSV-ben kötelező az identifier + kategoria oszlop (régi viselkedés).
 *
 * A CSV lehet pontosvesszővel (;) vagy vesszővel (,) tagolt, fejléces vagy fejléc nélküli (csak azonosítók).
 */
export function parseDevicesCsv(
  content: string,
  options?: ParseDevicesCsvOptions,
): DeviceCsvRow[] {
  const categoryOverride = options?.categoryOverride ?? null;
  const trimmed = content.trim();
  if (!trimmed) return [];

  // Fejléc nélküli, egysoros lista esetén (pl. csak azonosítók egymás után soronként)
  // észleljük ha nincs header: ha az első sor nem tartalmaz ismert fejléckulcsot
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const hasHeader =
    /keszulek|identifier|device|kategoria|category/i.test(firstLine);

  // Elválasztó detektálása: ha az első sorban pontosvessző van → ";" egyébként ","
  const delimiter = firstLine.includes(";") ? ";" : ",";

  if (!hasHeader && categoryOverride) {
    // Egyszerű lista: minden sor egy azonosító
    return trimmed
      .split(/\r?\n/)
      .map((line, idx) => {
        const identifier = line.trim();
        if (!identifier) return null;
        return { identifier, category: categoryOverride, sourceLineNumber: idx + 1 };
      })
      .filter((row): row is DeviceCsvRow => Boolean(row));
  }

  const records = parse(trimmed, {
    delimiter,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return records
    .map((record, idx) => {
      const identifier = pickField(record, [
        "keszulek szama",
        "keszulek szam",
        "eszkoz azonosito",
        "eszkozazonosito",
        "identifier",
        "device id",
      ]);

      let category: DeviceCategory | null = categoryOverride;
      if (!category) {
        const categoryRaw = pickField(record, [
          "kategoria",
          "category",
          "jarmukategoria",
          "jarmu kategoria",
        ]);
        category = mapCategory(categoryRaw);
      }

      if (!identifier || !category) return null;

      return {
        identifier,
        category,
        sourceLineNumber: idx + 2,
      };
    })
    .filter((row): row is DeviceCsvRow => Boolean(row));
}
