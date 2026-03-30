"use client";

import { useEffect, useMemo, useState } from "react";

import {
  applyTopupDiscount,
  isSmallestTopupPackage,
  isTopupPackageBlockedForCategory,
} from "@/lib/topup-calculations";

type ConfigDevice = {
  id: string;
  identifier: string;
  category: string;
  status: string;
  balance_eur: number;
  smallestPackageBlocked: boolean;
};

type ConfigResponse = {
  ok: boolean;
  error?: string;
  packages?: number[];
  discountPercent?: number;
  minBalanceWarningEur?: number;
  fxEurToHuf?: number;
  blockedCategoriesForSmallestPackage?: string[];
  devices?: ConfigDevice[];
  destinations?: {
    id: string;
    name: string;
    price_ia: number;
    price_i: number;
    price_ii: number;
    price_iii: number;
    price_iv: number;
  }[];
};

export function TopupClient({ initialDeviceIdentifier = "" }: { initialDeviceIdentifier?: string }) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [travelDestination, setTravelDestination] = useState("");
  const [destinationMode, setDestinationMode] = useState<"list" | "custom">("list");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/topup/config");
        const data = (await res.json()) as ConfigResponse;
        if (cancelled) return;
        if (!data.ok || !data.packages?.length) {
          setLoadError(data.error ?? "Nem tölthető a feltöltési konfiguráció.");
          return;
        }
        setConfig(data);
        setSelectedAmount(data.packages[0]);
        const initial = initialDeviceIdentifier.trim();
        if (initial && (data.devices ?? []).some((d) => d.identifier === initial)) {
          setDeviceIdentifier(initial);
        }
        if ((data.destinations?.length ?? 0) === 0) {
          setDestinationMode("custom");
        }
      } catch {
        if (!cancelled) setLoadError("Hálózati hiba a konfiguráció betöltése során.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDeviceIdentifier]);

  const packages = config?.packages ?? [];
  const discountPercent = config?.discountPercent ?? 0;
  const destinations = config?.destinations ?? [];
  const devices = config?.devices ?? [];

  const selectedDevice = useMemo(
    () => devices.find((d) => d.identifier === deviceIdentifier.trim()) ?? null,
    [devices, deviceIdentifier],
  );

  const blockedSet = useMemo(() => {
    const raw = config?.blockedCategoriesForSmallestPackage ?? ["ii", "iii", "iv"];
    return new Set(raw.map((s) => s.trim().toLowerCase()).filter(Boolean));
  }, [config?.blockedCategoriesForSmallestPackage]);

  const packageDisabled = (amount: number) => {
    if (!selectedDevice) return false;
    if (minimumRequiredTopup > 0) return amount < minimumRequiredTopup;
    return isTopupPackageBlockedForCategory(
      selectedDevice.category,
      amount,
      packages,
      blockedSet,
    );
  };

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.name === travelDestination) ?? null,
    [destinations, travelDestination],
  );

  const destinationRequiredEur = useMemo(() => {
    if (!selectedDestination || !selectedDevice) return 0;
    const cat = selectedDevice.category.toLowerCase();
    const byCat: Record<string, number> = {
      ia: selectedDestination.price_ia ?? 0,
      i: selectedDestination.price_i ?? 0,
      ii: selectedDestination.price_ii ?? 0,
      iii: selectedDestination.price_iii ?? 0,
      iv: selectedDestination.price_iv ?? 0,
    };
    return Number(byCat[cat] ?? 0);
  }, [selectedDestination, selectedDevice]);

  const currentBalanceEur = Number(selectedDevice?.balance_eur ?? 0);
  const minimumRequiredTopup = Math.max(0, destinationRequiredEur - currentBalanceEur);
  const canAnyPackageCoverMinimum =
    minimumRequiredTopup > 0 ? packages.some((p) => p >= minimumRequiredTopup) : false;
  const manualTopupMode = minimumRequiredTopup > 0 && !canAnyPackageCoverMinimum;

  useEffect(() => {
    if (selectedAmount == null || !selectedDevice) return;
    if (packageDisabled(selectedAmount)) {
      const next = packages.find((p) => !packageDisabled(p));
      if (next != null) setSelectedAmount(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.identifier, selectedDevice?.category, packages.join(","), minimumRequiredTopup]);

  useEffect(() => {
    if (manualTopupMode) {
      setCustomAmount((prev) => {
        const n = Number.parseFloat(prev);
        if (!Number.isFinite(n) || n < minimumRequiredTopup) {
          return minimumRequiredTopup.toFixed(2);
        }
        return prev;
      });
    }
  }, [manualTopupMode, minimumRequiredTopup]);

  async function startCheckout() {
    setError(null);
    const manualAmountValue = Number.parseFloat(customAmount.trim());
    const effectiveAmount =
      manualTopupMode || Number.isFinite(manualAmountValue) ? manualAmountValue : selectedAmount ?? 0;

    if (!effectiveAmount || !Number.isFinite(effectiveAmount)) {
      setError(manualTopupMode ? "Add meg a feltöltés összegét." : "Válassz csomagot.");
      return;
    }
    const dev = deviceIdentifier.trim();
    if (!dev) {
      setError("Válassz készüléket a listából.");
      return;
    }
    const dest = travelDestination.trim();
    if (dest.length < 2) {
      setError("Add meg az úticélt.");
      return;
    }
    if (!manualTopupMode && packageDisabled(effectiveAmount)) {
      setError("Ehhez a készülékhez nem választható a legkisebb csomag.");
      return;
    }
    if (manualTopupMode && effectiveAmount < minimumRequiredTopup) {
      setError(
        `Ehhez az úticélhoz legalább ${minimumRequiredTopup.toLocaleString("hu-HU")} EUR feltöltés szükséges.`,
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topupAmountEur: effectiveAmount,
          deviceIdentifier: dev,
          travelDestination: dest,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        url?: string;
      };
      if (!data.ok || !data.url) {
        setError(data.error ?? "Nem sikerült a checkout indítása.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Hálózati hiba történt.");
    } finally {
      setIsLoading(false);
    }
  }

  if (loadError) {
    return (
      <div className="adria-animate-in adria-delay-3 mt-8 rounded-xl border border-red-200/80 bg-danger-light px-4 py-3 text-sm text-danger shadow-sm">
        {loadError}
      </div>
    );
  }

  if (!config || selectedAmount == null) {
    return (
      <p className="adria-animate-in adria-delay-3 mt-8 text-sm text-muted">Konfiguráció betöltése…</p>
    );
  }

  const previewAmount = manualTopupMode
    ? Math.max(minimumRequiredTopup, Number.parseFloat(customAmount || "0") || 0)
    : selectedAmount;
  const charged = manualTopupMode ? previewAmount : applyTopupDiscount(selectedAmount, discountPercent);
  const showDiscount = !manualTopupMode && discountPercent > 0 && charged !== selectedAmount;

  return (
    <section className="mt-8 space-y-6">
      <div className="adria-animate-in adria-delay-3 adria-glass rounded-2xl p-6 transition-shadow duration-300 md:p-8">
        <h2 className="text-xl font-semibold">Csomag és úticél</h2>
        <p className="mt-2 text-sm text-muted">
          Csak a fiókodhoz rendelt készülékre tölthetsz fel egyenleget. A legkisebb csomag egyes
          járműkategóriáknál nem elérhető (beállítás:{" "}
          <span className="font-medium text-foreground">
            {(config.blockedCategoriesForSmallestPackage ?? []).join(", ") || "ii, iii, iv"}
          </span>
          ).
        </p>

        {config.minBalanceWarningEur != null && (
          <p className="mt-2 text-xs text-muted">
            Figyelmeztetési küszöb alacsony egyenleghez:{" "}
            <span className="font-medium">{config.minBalanceWarningEur.toLocaleString("hu-HU")} EUR</span> (e-mail értesítés).
          </p>
        )}

        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="devicePick">
            Készülék *
          </label>
          {devices.length === 0 ? (
            <div className="rounded-xl border border-amber-200/90 bg-warning-light/95 px-4 py-3 text-sm text-amber-900 shadow-sm">
              Nincs a fiókodhoz kötött készülék. Vásárolj ENC-t a <strong>Rendelés</strong> menüben, vagy várd meg a
              hozzárendelést.
            </div>
          ) : (
            <select
              id="devicePick"
              value={deviceIdentifier}
              onChange={(e) => setDeviceIdentifier(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
            >
              <option value="">— válassz —</option>
              {devices.map((d) => (
                <option key={d.id} value={d.identifier}>
                  {d.identifier} ({String(d.category).toUpperCase()}) — egyenleg:{" "}
                  {Number(d.balance_eur ?? 0).toLocaleString("hu-HU")} EUR
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Úticél *</label>
          {destinations.length > 0 && destinationMode === "list" ? (
            <>
              <input
                list="topup-destination-options"
                value={travelDestination}
                onChange={(e) => setTravelDestination(e.target.value)}
                placeholder="Kezdj el gépelni, majd válassz a listából…"
                className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
              />
              <datalist id="topup-destination-options">
                {destinations.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </datalist>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-primary hover:underline"
                onClick={() => setDestinationMode("custom")}
              >
                Egyéb (saját megnevezés)
              </button>
            </>
          ) : (
            <>
              <input
                value={travelDestination}
                onChange={(e) => setTravelDestination(e.target.value)}
                placeholder="pl. Horvátország, Szlovénia…"
                className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
              />
              {destinations.length > 0 && (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => setDestinationMode("list")}
                >
                  Lista választása
                </button>
              )}
            </>
          )}
        </div>
        {selectedDevice && selectedDestination && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
            <p>
              Jelenlegi egyenleg: <strong>{currentBalanceEur.toLocaleString("hu-HU")} EUR</strong> | Úticélhoz ajánlott:
              <strong> {destinationRequiredEur.toLocaleString("hu-HU")} EUR</strong>
            </p>
            {manualTopupMode ? (
              <p className="mt-1">
                Legalább <strong>{minimumRequiredTopup.toLocaleString("hu-HU")} EUR</strong> feltöltés szükséges.
              </p>
            ) : minimumRequiredTopup > 0 ? (
              <p className="mt-1">
                Legalább <strong>{minimumRequiredTopup.toLocaleString("hu-HU")} EUR</strong> feltöltés kell, ezt csomagból is ki tudod választani.
              </p>
            ) : (
              <p className="mt-1">A jelenlegi egyenleg elegendő, csomag alapú feltöltést választhatsz.</p>
            )}
          </div>
        )}
      </div>

      <div className="adria-animate-in adria-delay-4 adria-glass rounded-2xl p-6 transition-shadow duration-300 md:p-8">
        <h2 className="text-lg font-semibold">{manualTopupMode ? "Egyedi feltöltés" : "Feltöltési csomagok"}</h2>
        {manualTopupMode ? (
          <div className="mt-4 space-y-2">
            <input
              type="number"
              min={minimumRequiredTopup}
              step={0.01}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`${minimumRequiredTopup.toLocaleString("hu-HU")} vagy több`}
              className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
            />
            <p className="text-xs text-slate-600">
              Ennél a feltöltésnél a topup kedvezmény nem érvényes; minimum:{" "}
              {minimumRequiredTopup.toLocaleString("hu-HU")} EUR.
            </p>
            <p className="text-xs text-slate-600">
              Fizetendő: <strong>{charged.toLocaleString("hu-HU")} EUR</strong>
            </p>
          </div>
        ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {packages.map((amount) => {
            const active = amount === selectedAmount;
            const disabled = packageDisabled(amount);
            const smallest = isSmallestTopupPackage(amount, packages);
            return (
              <button
                key={amount}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedAmount(amount)}
                className={`rounded-2xl border px-5 py-5 text-left transition duration-200 ${
                  disabled
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-50"
                    : active
                      ? "border-primary bg-primary-light shadow-md ring-2 ring-primary/25"
                      : "border-border/80 bg-white/85 shadow-sm hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Csomag</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{amount.toLocaleString("hu-HU")} EUR</p>
                {disabled && smallest && (
                  <p className="mt-2 text-xs text-amber-700">Nem elérhető ebben a kategóriában</p>
                )}
                {discountPercent > 0 && !disabled && (
                  <p className="mt-2 text-xs text-success">
                    Fizetendő: {applyTopupDiscount(amount, discountPercent).toLocaleString("hu-HU")} EUR ({discountPercent}%
                    kedvezmény)
                  </p>
                )}
              </button>
            );
          })}
        </div>
        )}

        {showDiscount && selectedAmount != null && (
          <p className="mt-4 text-sm text-muted">
            Kiválasztott csomag: <strong className="text-foreground">{selectedAmount.toLocaleString("hu-HU")} EUR</strong> →
            fizetendő: <strong className="text-foreground">{charged.toLocaleString("hu-HU")} EUR</strong>
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={startCheckout}
        disabled={isLoading || devices.length === 0}
        className="adria-animate-in adria-delay-5 adria-btn-primary w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:transform-none"
      >
        {isLoading ? "Átirányítás…" : "Fizetés Stripe-pal"}
      </button>

      <div className="adria-animate-in adria-delay-6 flex items-center justify-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/90 px-4 py-3 text-center shadow-sm">
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
          Titkos és biztonságos fizetés <span className="ml-1 font-extrabold text-[#635BFF]">stripe</span>
        </p>
      </div>
    </section>
  );
}
