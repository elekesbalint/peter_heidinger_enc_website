"use client";

import { useRef, useState } from "react";
import { DEVICE_CATEGORY_VALUES, DEVICE_CATEGORY_LABELS } from "@/lib/device-categories";

type ImportResponse = {
  ok: boolean;
  error?: string;
  fileName?: string;
  parsedRows?: number;
  insertedRows?: number;
  skippedRows?: number;
  category?: string;
};

export function ImportDevicesForm() {
  const [category, setCategory] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!category) {
      setResult({ ok: false, error: "Válassz eszközkategóriát a legördülőből." });
      return;
    }

    formData.set("category", category);

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/devices/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ImportResponse;
      setResult(data);
      if (data.ok) {
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setResult({ ok: false, error: "Hálózati hiba történt." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Tömeges eszköz import (CSV)</h3>
      <p className="mt-1 text-sm text-muted">
        Válaszd ki a kategóriát, töltsd fel a CSV-t, és az összes azonosítót egyszerre importáljuk.
      </p>

      <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs text-muted space-y-1">
        <p className="font-semibold text-slate-600">CSV formátum:</p>
        <p>• Legegyszerűbb: egy azonosító soronként, fejléc nélkül</p>
        <p>• Vagy: <code className="rounded bg-slate-200 px-1 py-0.5">identifier</code> fejléccel, pontosvessző (<code className="rounded bg-slate-200 px-1 py-0.5">;</code>) vagy vessző (<code className="rounded bg-slate-200 px-1 py-0.5">,</code>) tagolással</p>
        <p>• A kategória a legördülőből kerül beállításra — a CSV-ben nem kell külön oszlop</p>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1.5 block text-xs font-medium text-muted uppercase tracking-wide">
              Eszközkategória <span className="text-danger">*</span>
            </label>
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
              required
            >
              <option value="">— válassz —</option>
              {DEVICE_CATEGORY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {DEVICE_CATEGORY_LABELS[v]} ({v.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-[2] min-w-[240px]">
            <label className="mb-1.5 block text-xs font-medium text-muted uppercase tracking-wide">
              CSV fájl <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                name="file"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                fileName ? "border-primary/50 bg-primary-light text-primary" : "border-border bg-white text-muted"
              }`}>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="truncate">{fileName ?? "Tallózás…"}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !category}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Import folyamatban…" : "Import indítása"}
          </button>
        </div>
      </form>

      {result && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${
          result.ok
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          {result.ok ? (
            <div className="space-y-1">
              <p className="font-semibold">Import sikeres ✓</p>
              <p>Fájl: <strong>{result.fileName}</strong></p>
              <p>Kategória: <strong>{result.category}</strong></p>
              <p>Feldolgozott sorok: <strong>{result.parsedRows}</strong></p>
              <p>Új eszközök: <strong className="text-green-700">{result.insertedRows}</strong></p>
              <p>Kihagyott (már létező): <strong>{result.skippedRows}</strong></p>
            </div>
          ) : (
            <p>{result.error ?? "Ismeretlen hiba történt."}</p>
          )}
        </div>
      )}
    </section>
  );
}
