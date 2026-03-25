"use client";

import { useState } from "react";

type ImportResponse = {
  ok: boolean;
  error?: string;
  fileName?: string;
  parsedRows?: number;
  insertedRows?: number;
  skippedRows?: number;
  linkedDeviceRows?: number;
};

export function ImportRoutesForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setResult({ ok: false, error: "Válassz ki egy CSV fájlt." });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/routes/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ImportResponse;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Hálózati hiba történt." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Útvonal CSV import</h3>
      <p className="mt-2 text-sm text-muted">
        A feltöltés deduplikálva menti az útvonal rekordokat.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Import folyamatban…" : "CSV import indítása"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${
            result.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.ok ? (
            <div className="space-y-1">
              <p>
                Fájl: <strong>{result.fileName}</strong>
              </p>
              <p>Feldolgozott sorok: {result.parsedRows}</p>
              <p>Új rekordok: {result.insertedRows}</p>
              <p>Kihagyott (duplikált): {result.skippedRows}</p>
              <p>Eszközhöz kapcsolt sorok: {result.linkedDeviceRows}</p>
            </div>
          ) : (
            <p>{result.error ?? "Ismeretlen hiba."}</p>
          )}
        </div>
      )}
    </section>
  );
}
