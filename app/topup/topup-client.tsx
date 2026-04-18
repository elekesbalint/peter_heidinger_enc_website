"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  /** Egyéni úticél (vagy nem árazott listaelem) esetén alkalmazott minimum EUR; admin: topup_custom_destination_min_eur */
  customDestinationMinEur?: number;
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
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPackageAmount, setSelectedPackageAmount] = useState<number | null>(null);
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [travelDestination, setTravelDestination] = useState("");
  const [destinationMode, setDestinationMode] = useState<"list" | "custom">("list");
  const [destinationDropdownOpen, setDestinationDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destinationPickerRef = useRef<HTMLDivElement | null>(null);
  /** Előző kötelező minimum — csak emelkedéskor / első 0→pozitív szinkronnál írjuk felül a mezőt; üres mezőt gépeléshez megtartjuk. */
  const prevMinimumTopupRef = useRef<number | null>(null);

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
  const destinations = config?.destinations ?? [];
  const devices = config?.devices ?? [];

  const selectedDevice = useMemo(
    () => devices.find((d) => d.identifier === deviceIdentifier.trim()) ?? null,
    [devices, deviceIdentifier],
  );

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.name === travelDestination) ?? null,
    [destinations, travelDestination],
  );
  const filteredDestinations = useMemo(() => {
    const q = travelDestination.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter((d) => d.name.toLowerCase().includes(q));
  }, [destinations, travelDestination]);

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
  const customDestinationMinEur = Math.max(0, Number(config?.customDestinationMinEur ?? 30));
  const hasPricedListDestination = Boolean(selectedDestination && destinationRequiredEur > 0);
  const gapToDestinationEur = Math.max(0, destinationRequiredEur - currentBalanceEur);
  let minimumRequiredTopup = hasPricedListDestination ? gapToDestinationEur : 0;
  if (!hasPricedListDestination && customDestinationMinEur > 0 && selectedDevice && travelDestination.trim().length >= 2) {
    minimumRequiredTopup = Math.max(gapToDestinationEur, customDestinationMinEur);
  }
  const discountPercent = Math.max(0, Number(config?.discountPercent ?? 0));

  /**
   * Minimum követése: első alkalommal (0 → pozitív) kitöltjük a mezőt; ha a minimum emelkedik, a számot felhúzzuk.
   * Üres vagy részleges bevitel nem íródik felül — kitörölhető a 87, majd beírható pl. 150.
   */
  useEffect(() => {
    setSelectedPackageAmount(null);

    const prevStored = prevMinimumTopupRef.current;
    const prevMinSafe = prevStored ?? 0;

    if (minimumRequiredTopup <= 0) {
      prevMinimumTopupRef.current = minimumRequiredTopup;
      return;
    }

    setCustomAmount((prev) => {
      const trimmed = String(prev).trim();

      if (trimmed === "") {
        if (minimumRequiredTopup > prevMinSafe && prevMinSafe === 0) {
          return minimumRequiredTopup.toFixed(2);
        }
        return prev;
      }

      const current = Number.parseFloat(trimmed.replace(",", "."));
      if (!Number.isFinite(current)) return prev;

      if (minimumRequiredTopup > prevMinSafe && current < minimumRequiredTopup) {
        return minimumRequiredTopup.toFixed(2);
      }

      return prev;
    });

    prevMinimumTopupRef.current = minimumRequiredTopup;
  }, [minimumRequiredTopup]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!destinationPickerRef.current) return;
      const target = event.target;
      if (target instanceof Node && destinationPickerRef.current.contains(target)) return;
      setDestinationDropdownOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  function normalizeTopupAmountOnBlur() {
    const raw = customAmount.trim().replace(",", ".");
    if (raw === "") return;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return;
    if (minimumRequiredTopup > 0 && n < minimumRequiredTopup) {
      setCustomAmount(minimumRequiredTopup.toFixed(2));
      return;
    }
    if (minimumRequiredTopup <= 0 && n <= 0) return;
    setCustomAmount(Number(n.toFixed(2)).toFixed(2));
  }

  async function startCheckout() {
    setError(null);
    const manualAmountValue = Number.parseFloat(customAmount.trim().replace(",", "."));
    const effectiveAmount = manualAmountValue;

    if (!effectiveAmount || !Number.isFinite(effectiveAmount)) {
      setError("Add meg a feltöltés összegét.");
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
    if (effectiveAmount < minimumRequiredTopup) {
      setError(
        hasPricedListDestination
          ? `Ehhez az úticélhoz legalább ${minimumRequiredTopup.toLocaleString("hu-HU")} EUR feltöltés szükséges.`
          : `Egyéni vagy nem árazott úticél esetén legalább ${minimumRequiredTopup.toLocaleString("hu-HU")} EUR feltöltés szükséges.`,
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/barion/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topupAmountEur: effectiveAmount,
          selectedPackageEur: selectedPackageAmount,
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

  if (!config) {
    return (
      <p className="adria-animate-in adria-delay-3 mt-8 text-sm text-muted">Konfiguráció betöltése…</p>
    );
  }

  const parsedCustomAmount = Number.parseFloat(String(customAmount || "0").replace(",", "."));
  const charged = Math.max(
    minimumRequiredTopup,
    Number.isFinite(parsedCustomAmount) ? parsedCustomAmount : 0,
  );
  const packageDiscountedCharged =
    selectedPackageAmount != null && discountPercent > 0
      ? Number((charged * (100 - Math.min(100, discountPercent))) / 100).toFixed(2)
      : charged.toFixed(2);
  const payable = Number(packageDiscountedCharged);

  return (
    <section className="mt-8 space-y-6">
      <div className="adria-animate-in adria-delay-3 adria-glass relative z-20 rounded-2xl p-6 transition-shadow duration-300 md:p-8">
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
              <div ref={destinationPickerRef} className="relative">
                <input
                  value={travelDestination}
                  onChange={(e) => {
                    setTravelDestination(e.target.value);
                    setDestinationDropdownOpen(true);
                  }}
                  onFocus={() => setDestinationDropdownOpen(true)}
                  placeholder="Kezdj el gépelni, majd válassz a listából…"
                  className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
                />
                {destinationDropdownOpen && (
                  <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border/80 bg-white shadow-lg">
                    <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
                      {filteredDestinations.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted">Nincs találat.</p>
                      ) : (
                        filteredDestinations.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setTravelDestination(d.name);
                              setDestinationDropdownOpen(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-slate-100"
                          >
                            {d.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
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
        {selectedDevice &&
          travelDestination.trim().length >= 2 &&
          (hasPricedListDestination || destinationMode === "custom" || Boolean(selectedDestination)) && (
          <>
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
              {hasPricedListDestination ? (
                <p>
                  Jelenlegi egyenleg: <strong>{currentBalanceEur.toLocaleString("hu-HU")} EUR</strong> | Úticélhoz ajánlott:
                  <strong> {destinationRequiredEur.toLocaleString("hu-HU")} EUR</strong>
                </p>
              ) : selectedDestination ? (
                <p>
                  Úticél: <strong>{selectedDestination.name}</strong>
                  <span className="mt-1 block text-xs text-indigo-900/85">
                    Ehhez a járműkategóriához nincs tárolt listaár; minimum feltöltés az admin által beállított érték szerint.
                  </span>
                </p>
              ) : (
                <p>
                  <span className="font-medium">Egyéni úticél:</span> {travelDestination.trim()}
                  <span className="mt-1 block text-xs text-indigo-900/85">
                    Listaáras ajánlott összeg ehhez a megnevezéshez nem elérhető;
                  </span>
                </p>
              )}
              {minimumRequiredTopup > 0 ? (
                <p className="mt-1">
                  Minimum szükséges feltöltés:{" "}
                  <strong>{minimumRequiredTopup.toLocaleString("hu-HU")} EUR</strong>
                </p>
              ) : (
                <p className="mt-1">A jelenlegi egyenleg elegendő, egyedi feltöltés opcionális.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              A hozzávetőlegesen kalkulált útdíj Letenye határátkelővel értendő. Ha más határátkelőt választasz, érdemes
              magasabb összeggel feltölteni a készülékedet, mert az út más szakaszon drágább lehet.
            </p>
          </>
        )}
      </div>

      <div className="adria-animate-in adria-delay-4 adria-glass relative z-10 rounded-2xl p-6 transition-shadow duration-300 md:p-8">
        <h2 className="text-lg font-semibold">Feltöltés összege</h2>
        <div className="mt-4 space-y-2">
          <input
            type="text"
            inputMode="decimal"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setSelectedPackageAmount(null);
            }}
            onBlur={() => normalizeTopupAmountOnBlur()}
            placeholder={`${minimumRequiredTopup.toLocaleString("hu-HU")} vagy több`}
            className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
          />
          {selectedPackageAmount == null ? (
            <p className="text-xs text-slate-600">
              Ennél a feltöltésnél a topup kedvezmény nem érvényes; minimum:{" "}
              {minimumRequiredTopup.toLocaleString("hu-HU")} EUR.
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              Csomag kedvezmény: {discountPercent}%.
            </p>
          )}
          <p className="text-xs text-slate-600">
            Fizetendő: <strong>{payable.toLocaleString("hu-HU")} EUR</strong>
          </p>
        </div>
        {packages.length > 0 && (
          <>
            <p className="mt-4 text-xs text-muted">Gyors választás (automatikusan kitölti az összeget):</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {packages.map((amount) => {
            const selectedAmount = Number.parseFloat(String(customAmount || "0").replace(",", "."));
            const active = Math.abs(selectedAmount - amount) < 0.001;
            const disabled = amount < minimumRequiredTopup;
            return (
              <button
                key={amount}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setCustomAmount(String(amount));
                  setSelectedPackageAmount(amount);
                }}
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
                <p className="mt-2 text-xs text-success">
                  Kedvezmény után:{" "}
                  {Number(
                    discountPercent > 0
                      ? Number((amount * (100 - Math.min(100, discountPercent))) / 100).toFixed(2)
                      : amount.toFixed(2)
                  ).toLocaleString("hu-HU")}{" "}
                  EUR
                </p>
                {disabled && (
                  <p className="mt-2 text-xs text-amber-700">
                    Ennél az úticélnál legalább {minimumRequiredTopup.toLocaleString("hu-HU")} EUR szükséges
                  </p>
                )}
                {!disabled && (
                  <p className="mt-2 text-xs text-success">
                    Kedvezmény: {Math.min(100, discountPercent).toLocaleString("hu-HU")}%
                  </p>
                )}
              </button>
            );
          })}
        </div>
          </>
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
        {isLoading ? "Átirányítás…" : "Fizetés Barionnal"}
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
          Titkos és biztonságos fizetés <span className="ml-1 font-extrabold text-[#2d7a4d]">Barion</span>
        </p>
      </div>
    </section>
  );
}
