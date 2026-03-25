import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

export type EncCsvRow = {
  relationLabel: string;
  gatePath: string;
  executedAt: Date;
  entryAt: Date | null;
  exitAt: Date | null;
  deviceNumberRaw: string;
  licensePlate: string | null;
  amount: number;
  currency: string;
  sourceLineNumber: number;
  dedupeKey: string;
};

const DELIMITER = ";";

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const [datePart, timePart] = trimmed.split(" ");
  if (!datePart || !timePart) return null;

  const [day, month, year] = datePart.split(".").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  if (
    [day, month, year, hour, minute, second].some((part) =>
      Number.isNaN(part),
    )
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function parseAmount(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const amount = Number(normalized);
  if (Number.isNaN(amount)) {
    throw new Error(`Invalid amount in CSV: "${value}"`);
  }
  return amount;
}

function makeDedupeKey(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function parseEncCsv(content: string): EncCsvRow[] {
  const records = parse(content, {
    delimiter: DELIMITER,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return records.map((record, idx) => {
    const relationLabel = record["Reláció"] ?? "";
    const gatePath = relationLabel;
    const executedAt =
      parseDate(record["A tranzakció végrehajtásának dátuma"] ?? "") ??
      new Date(0);
    const entryAt = parseDate(record["Behajtás ideje"] ?? "");
    const exitAt = parseDate(record["Kihajtás ideje"] ?? "");
    const deviceNumberRaw = (record["Készülék száma"] ?? "").trim();
    const licensePlate = (record["Rendszám"] ?? "").trim() || null;
    const amount = parseAmount(record["Kifizetés (HRK)"] ?? "0");
    const currency = (record["Pénznem"] ?? "EUR").trim() || "EUR";
    const sourceLineNumber = idx + 2;

    const dedupeKey = makeDedupeKey(
      [
        deviceNumberRaw,
        relationLabel,
        executedAt.toISOString(),
        amount.toFixed(2),
        currency,
      ].join("|"),
    );

    return {
      relationLabel,
      gatePath,
      executedAt,
      entryAt,
      exitAt,
      deviceNumberRaw,
      licensePlate,
      amount,
      currency,
      sourceLineNumber,
      dedupeKey,
    };
  });
}
