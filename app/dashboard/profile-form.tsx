"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  auth_user_id: string;
  user_type: string;
  name: string | null;
  phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
};

type AddressFields = {
  country: string;
  zip: string;
  city: string;
  street: string;
  extra: string;
};

const fieldClass = "w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition";

const emptyAddress = (): AddressFields => ({
  country: "Magyarország",
  zip: "",
  city: "",
  street: "",
  extra: "",
});

function parseAddress(raw: string | null | undefined): AddressFields {
  const result = emptyAddress();
  if (!raw) return result;

  const compact = raw.replace(/\n/g, ", ").replace(/\s+/g, " ").trim();
  if (!compact) return result;

  const parts = compact.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 4) {
    result.country = parts[0] || result.country;
    const zipCity = parts[1] || "";
    const zipCityMatch = zipCity.match(/^(\d{4})\s+(.+)$/);
    if (zipCityMatch) {
      result.zip = zipCityMatch[1] ?? "";
      result.city = zipCityMatch[2] ?? "";
    } else {
      result.city = zipCity;
    }
    result.street = parts[2] || "";
    result.extra = parts.slice(3).join(", ");
    return result;
  }

  const zipCityMatch = compact.match(/(\d{4})\s+([^,]+)/);
  if (zipCityMatch) {
    result.zip = zipCityMatch[1] ?? "";
    result.city = (zipCityMatch[2] ?? "").trim();
  }

  const countryMatch = compact.match(/^(Magyarország|Hungary)[,\s]+/i);
  if (countryMatch) {
    result.country = countryMatch[1] ?? result.country;
  }

  result.street = compact;
  return result;
}

function formatAddress(addr: AddressFields): string | null {
  const country = addr.country.trim();
  const zip = addr.zip.trim();
  const city = addr.city.trim();
  const street = addr.street.trim();
  const extra = addr.extra.trim();

  const hasMain = country || zip || city || street || extra;
  if (!hasMain) return null;

  const zipCity = [zip, city].filter(Boolean).join(" ").trim();
  return [country || "Magyarország", zipCity, street, extra].filter(Boolean).join(", ");
}

function hasAddressData(addr: AddressFields): boolean {
  const country = addr.country.trim().toLowerCase();
  const hasOnlyDefaultCountry = country === "" || country === "magyarország" || country === "hungary";
  return Boolean(
    (!hasOnlyDefaultCountry && addr.country.trim()) ||
      addr.zip.trim() ||
      addr.city.trim() ||
      addr.street.trim() ||
      addr.extra.trim(),
  );
}

function addressSummary(addr: AddressFields): string {
  const zipCity = [addr.zip.trim(), addr.city.trim()].filter(Boolean).join(" ").trim();
  return [zipCity, addr.street.trim(), addr.extra.trim()].filter(Boolean).join(", ") || "Nincs kitöltve";
}

function hasProfileData(profile: Profile, billingAddress: AddressFields, shippingAddress: AddressFields): boolean {
  return Boolean(
    (profile.name ?? "").trim() ||
      (profile.phone ?? "").trim() ||
      hasAddressData(billingAddress) ||
      hasAddressData(shippingAddress),
  );
}

function validateAddress(label: string, addr: AddressFields): string | null {
  const zip = addr.zip.trim();
  const city = addr.city.trim();
  const street = addr.street.trim();
  const hasAny = hasAddressData(addr);
  if (!hasAny) return null;

  if (zip && !/^\d{4}$/.test(zip)) {
    return `${label}: az irányítószám 4 számjegy legyen.`;
  }
  if (!city || !street) {
    return `${label}: város és utca/házszám megadása kötelező.`;
  }
  return null;
}

export function ProfileForm({ forceOpen = false }: { forceOpen?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [billingAddress, setBillingAddress] = useState<AddressFields>(emptyAddress);
  const [shippingAddress, setShippingAddress] = useState<AddressFields>(emptyAddress);
  const [profileOpen, setProfileOpen] = useState(true);
  const [billingOpen, setBillingOpen] = useState(true);
  const [shippingOpen, setShippingOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/profile");
        const data = (await res.json()) as {
          ok: boolean;
          profile?: Profile;
          email?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error ?? "Nem tölthető a profil.");
          return;
        }
        setProfile(data.profile ?? null);
        setEmail(data.email ?? null);
        const parsedBilling = parseAddress(data.profile?.billing_address);
        const parsedShipping = parseAddress(data.profile?.shipping_address);
        setBillingAddress(parsedBilling);
        setShippingAddress(parsedShipping);
        setProfileOpen(
          forceOpen ||
            !hasProfileData(
              data.profile ?? {
                auth_user_id: "",
                user_type: "private",
                name: null,
                phone: null,
                billing_address: null,
                shipping_address: null,
              },
              parsedBilling,
              parsedShipping,
            ),
        );
        setBillingOpen(!hasAddressData(parsedBilling));
        setShippingOpen(!hasAddressData(parsedShipping));
      } catch {
        if (!cancelled) setError("Hálózati hiba.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forceOpen]);

  useEffect(() => {
    if (forceOpen) setProfileOpen(true);
  }, [forceOpen]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setMessage(null);
    setError(null);

    const billingValidation = validateAddress("Számlázási cím", billingAddress);
    if (billingValidation) {
      setError(billingValidation);
      setBillingOpen(true);
      setProfileOpen(true);
      return;
    }
    const shippingValidation = validateAddress("Szállítási cím", shippingAddress);
    if (shippingValidation) {
      setError(shippingValidation);
      setShippingOpen(true);
      setProfileOpen(true);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_type: profile.user_type,
          name: profile.name,
          phone: profile.phone,
          billing_address: formatAddress(billingAddress),
          shipping_address: formatAddress(shippingAddress),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Mentési hiba.");
        return;
      }
      if (hasProfileData(profile, billingAddress, shippingAddress)) setProfileOpen(false);
      if (hasAddressData(billingAddress)) setBillingOpen(false);
      if (hasAddressData(shippingAddress)) setShippingOpen(false);
      setMessage("Profil mentve.");
      router.refresh();
    } catch {
      setError("Hálózati hiba.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Profil betöltése…</p>;
  }
  if (!profile) {
    return <p className="text-sm text-danger">{error ?? "Nincs profil."}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 text-sm">
      <button
        type="button"
        onClick={() => setProfileOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-slate-50/70 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <span>
          <span className="block text-sm font-medium text-foreground">Profil és címek</span>
          {!profileOpen && (
            <span className="mt-0.5 block text-xs text-muted">
              {(profile.name ?? "").trim() || email || "Nincs név"}{profile.phone ? ` · ${profile.phone}` : ""}
            </span>
          )}
        </span>
        <span className="rounded-lg border border-primary/25 bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
          {profileOpen ? "Összecsukás" : "Szerkesztés"}
        </span>
      </button>

      {profileOpen && (
        <>
          {email && (
            <p className="text-muted">
              Bejelentkezve: <strong className="text-foreground">{email}</strong>
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Fiók típusa</label>
            <select
              value={profile.user_type}
              onChange={(e) => setProfile({ ...profile, user_type: e.target.value })}
              className={fieldClass}
            >
              <option value="private">Magánszemély</option>
              <option value="company">Cég</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Név</label>
            <input
              value={profile.name ?? ""}
              onChange={(e) => setProfile({ ...profile, name: e.target.value || null })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Telefon</label>
            <input
              value={profile.phone ?? ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
              className={fieldClass}
            />
          </div>
          <div>
        <button
          type="button"
          onClick={() => setBillingOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-slate-50/70 px-4 py-3 text-left transition hover:bg-slate-50"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Számlázási cím</span>
            {!billingOpen && <span className="mt-0.5 block text-xs text-muted">{addressSummary(billingAddress)}</span>}
          </span>
          <span className="text-xs font-semibold text-muted">{billingOpen ? "Összecsukás" : "Szerkesztés"}</span>
        </button>
        {billingOpen && (
          <div className="mt-2 grid gap-3 rounded-xl border border-border/70 bg-slate-50/70 p-4 md:grid-cols-2">
            <input
              value={billingAddress.country}
              onChange={(e) => setBillingAddress({ ...billingAddress, country: e.target.value })}
              className={fieldClass}
              placeholder="Ország"
            />
            <input
              value={billingAddress.zip}
              onChange={(e) => setBillingAddress({ ...billingAddress, zip: e.target.value })}
              className={fieldClass}
              placeholder="Irányítószám (pl. 1117)"
              inputMode="numeric"
            />
            <input
              value={billingAddress.city}
              onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
              className={fieldClass}
              placeholder="Város"
            />
            <input
              value={billingAddress.street}
              onChange={(e) => setBillingAddress({ ...billingAddress, street: e.target.value })}
              className={fieldClass}
              placeholder="Utca, házszám"
            />
            <input
              value={billingAddress.extra}
              onChange={(e) => setBillingAddress({ ...billingAddress, extra: e.target.value })}
              className="md:col-span-2 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
              placeholder="Emelet, ajtó, egyéb (opcionális)"
            />
          </div>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => setShippingOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-slate-50/70 px-4 py-3 text-left transition hover:bg-slate-50"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Szállítási cím</span>
            {!shippingOpen && <span className="mt-0.5 block text-xs text-muted">{addressSummary(shippingAddress)}</span>}
          </span>
          <span className="text-xs font-semibold text-muted">{shippingOpen ? "Összecsukás" : "Szerkesztés"}</span>
        </button>
        {shippingOpen && (
          <div className="mt-2 grid gap-3 rounded-xl border border-border/70 bg-slate-50/70 p-4 md:grid-cols-2">
            <input
              value={shippingAddress.country}
              onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
              className={fieldClass}
              placeholder="Ország"
            />
            <input
              value={shippingAddress.zip}
              onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
              className={fieldClass}
              placeholder="Irányítószám (pl. 1117)"
              inputMode="numeric"
            />
            <input
              value={shippingAddress.city}
              onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
              className={fieldClass}
              placeholder="Város"
            />
            <input
              value={shippingAddress.street}
              onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
              className={fieldClass}
              placeholder="Utca, házszám"
            />
            <input
              value={shippingAddress.extra}
              onChange={(e) => setShippingAddress({ ...shippingAddress, extra: e.target.value })}
              className="md:col-span-2 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
              placeholder="Emelet, ajtó, egyéb (opcionális)"
            />
          </div>
        )}
      </div>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong disabled:opacity-60"
      >
        {saving ? "Mentés…" : "Profil mentése"}
      </button>
    </form>
  );
}
