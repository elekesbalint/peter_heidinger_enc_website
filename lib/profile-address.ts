/** Számlázási / szállítási cím — ugyanaz a formátum, mint a webes profil űrlapon. */

export type AddressFields = {
  country: string;
  zip: string;
  city: string;
  street: string;
  extra: string;
};

export function emptyAddress(): AddressFields {
  return {
    country: "Magyarország",
    zip: "",
    city: "",
    street: "",
    extra: "",
  };
}

export function parseAddress(raw: string | null | undefined): AddressFields {
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

export function formatAddress(addr: AddressFields): string | null {
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
