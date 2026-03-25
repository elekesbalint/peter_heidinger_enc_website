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

export function parseDevicesCsv(content: string): DeviceCsvRow[] {
  const records = parse(content, {
    delimiter: DELIMITER,
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
      const categoryRaw = pickField(record, [
        "kategoria",
        "category",
        "jarmukategoria",
        "jarmu kategoria",
      ]);
      const category = mapCategory(categoryRaw);

      if (!identifier || !category) return null;

      return {
        identifier,
        category,
        sourceLineNumber: idx + 2,
      };
    })
    .filter((row): row is DeviceCsvRow => Boolean(row));
}
