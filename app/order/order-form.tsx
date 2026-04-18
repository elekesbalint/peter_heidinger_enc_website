"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DEVICE_CATEGORY_LABELS,
  DEVICE_CATEGORY_VALUES,
  type DeviceCategoryValue,
} from "@/lib/device-categories";
import type { OrderWaitlistMessageSegment } from "@/lib/order-waitlist-message";

type CategoryGuideItems = Record<DeviceCategoryValue, string>;

type OrderFormProps = {
  categoryGuideTitle: string;
  categoryGuideSubtitle: string;
  categoryGuideItems: CategoryGuideItems;
};

function toBulletItems(raw: string): string[] {
  return raw
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function OrderForm({
  categoryGuideTitle,
  categoryGuideSubtitle,
  categoryGuideItems,
}: OrderFormProps) {
  const [category, setCategory] = useState<DeviceCategoryValue>("i");
  const [licensePlate, setLicensePlate] = useState("");
  const [contractAccepted, setContractAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitlistSegments, setWaitlistSegments] = useState<OrderWaitlistMessageSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWaitlistSegments(null);
    if (!contractAccepted) {
      setError("Fogadd el a vásárlási feltételeket a folytatáshoz.");
      return;
    }
    const plate = licensePlate.trim().toUpperCase().replace(/\s+/g, "");
    if (plate.length < 5 || plate.length > 12) {
      setError("Adj meg érvényes rendszámot (5–12 karakter).");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/barion/checkout-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          contractAccepted: true,
          licensePlate: plate,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        url?: string | null;
        waitlist?: boolean;
        message?: string;
        waitlistSegments?: OrderWaitlistMessageSegment[];
      };
      if (!data.ok) {
        setError(data.error ?? "Hiba történt.");
        return;
      }
      if (data.waitlist && (data.waitlistSegments?.length || data.message)) {
        setWaitlistSegments(
          data.waitlistSegments?.length ? data.waitlistSegments : [{ type: "text", text: data.message ?? "" }],
        );
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Nem kaptunk fizetési URL-t.");
    } catch {
      setError("Hálózati hiba történt.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="adria-animate-in adria-delay-4 adria-glass mt-8 space-y-6 rounded-2xl p-6 transition-shadow duration-300 md:p-8"
    >
      <div>
        <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
          Járműkategória
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as DeviceCategoryValue)}
          className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
        >
          {DEVICE_CATEGORY_VALUES.map((value) => (
            <option key={value} value={value}>
              {DEVICE_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
        <section className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-inner backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-foreground">{categoryGuideTitle}</h3>
          <p className="mt-1 text-xs text-muted">{categoryGuideSubtitle}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {DEVICE_CATEGORY_VALUES.map((value) => {
              const isActive = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-primary/40"
                  }`}
                >
                  {DEVICE_CATEGORY_LABELS[value]}
                </button>
              );
            })}
          </div>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-muted">
            {toBulletItems(categoryGuideItems[category]).map((item, idx) => (
              <li key={`${category}-${idx}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <div>
        <label htmlFor="licensePlate" className="mb-1.5 block text-sm font-medium text-foreground">
          Jármű rendszáma
        </label>
        <input
          id="licensePlate"
          value={licensePlate}
          onChange={(e) => setLicensePlate(e.target.value)}
          placeholder="pl. ABC-123"
          autoComplete="off"
          className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm uppercase shadow-sm transition"
        />
        <p className="mt-1.5 text-xs text-muted">
          A rendszám a készülékhez és a számlához kapcsolódik; sikeres fizetés után rögzítjük.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-inner backdrop-blur-sm">
        <p className="font-semibold text-foreground">Vásárlási feltételek</p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-muted">
          <li>A megrendelés Barion fizetést követ.</li>
          <li>Sikeres fizetés után a készülék a fiókodhoz kapcsolódik.</li>
          <li>Ha nincs szabad készülék, várólistára kerülsz — értesítünk.</li>
        </ul>
        <p className="mt-4 text-xs text-muted">
          Részletes jogi szöveg:{" "}
          <Link href="/aszf" className="font-medium text-primary underline">
            Általános Szerződési Feltételek
          </Link>
          ,{" "}
          <Link href="/adatvedelem" className="font-medium text-primary underline">
            Adatvédelem
          </Link>
          .
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={contractAccepted}
            onChange={(e) => setContractAccepted(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-border accent-primary"
          />
          <span className="text-sm text-foreground">Elfogadom a vásárlási feltételeket és az adatkezelést.</span>
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {waitlistSegments && waitlistSegments.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-warning-light px-4 py-3 text-sm text-amber-900">
          <p className="leading-relaxed">
            {waitlistSegments.map((seg, i) =>
              seg.type === "link" ? (
                <a
                  key={i}
                  href={seg.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-amber-950 !underline decoration-amber-800 underline-offset-2 decoration-2 transition hover:decoration-amber-950 ${
                    seg.bold ? "font-bold" : ""
                  }`}
                >
                  {seg.text}
                </a>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="adria-btn-primary w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:transform-none"
      >
        {isSubmitting ? "Feldolgozás…" : "Tovább a fizetéshez"}
      </button>

      <div className="flex items-center justify-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/90 px-4 py-3 text-center shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-emerald-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3l7 3v6c0 4.5-3.1 7.7-7 9-3.9-1.3-7-4.5-7-9V6l7-3z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <p className="text-base font-semibold text-slate-800">
          Titkos és biztonságos fizetés <span className="ml-1 font-extrabold text-[#2d7a4d]">Barion</span>
        </p>
      </div>
    </form>
  );
}
