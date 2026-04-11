import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/** Ugyanaz a cím-formátum, mint a webes profil űrlapon (csak mobil API, web fájlok érintése nélkül). */
type AddrFields = {
  country: string;
  zip: string;
  city: string;
  street: string;
  extra: string;
};

function emptyAddr(): AddrFields {
  return {
    country: "Magyarország",
    zip: "",
    city: "",
    street: "",
    extra: "",
  };
}

function parseAddr(raw: string | null | undefined): AddrFields {
  const result = emptyAddr();
  if (!raw) return result;

  const compact = raw.replace(/\n/g, ", ").replace(/\s+/g, " ").trim();
  if (!compact) return result;

  const parts = compact.split(",").map((p) => p.trim()).filter(Boolean);

  // ≥3 részes eset: "Ország, IRSZ Város, Utca [, extra...]"
  if (parts.length >= 3) {
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

  // 2 részes eset: próbáljunk kinyerni zip+city-t
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

function formatAddr(addr: AddrFields): string | null {
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

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function splitName(full: string | null): { first: string; last: string } {
  const t = (full ?? "").trim();
  if (!t) return { first: "", last: "" };
  const i = t.indexOf(" ");
  if (i === -1) return { first: t, last: "" };
  return { first: t.slice(0, i).trim(), last: t.slice(i + 1).trim() };
}

type ProfileRow = {
  auth_user_id: string;
  user_type: string;
  name: string | null;
  phone: string | null;
  company_name: string | null;
  tax_number: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  avatar_url: string | null;
};

export async function GET(request: Request) {
  try {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return Response.json({ ok: false, error: "Hiányzó bearer token." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return Response.json({ ok: false, error: "Érvénytelen token." }, { status: 401 });
    }
    const user = authData.user;

    const { data: row, error } = await supabase
      .from("profiles")
      .select(
        "auth_user_id, user_type, name, phone, company_name, tax_number, billing_address, shipping_address, avatar_url, updated_at",
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const profile = (row ?? {
      auth_user_id: user.id,
      user_type: "private",
      name: null,
      phone: null,
      company_name: null,
      tax_number: null,
      billing_address: null,
      shipping_address: null,
      avatar_url: null,
    }) as ProfileRow;

    const billing = parseAddr(profile.billing_address);
    const shipping = parseAddr(profile.shipping_address);
    const { first, last } = splitName(profile.name);

    return Response.json({
      ok: true,
      email: user.email ?? "",
      first_name: first,
      last_name: last,
      phone: profile.phone ?? "",
      address_country: billing.country,
      address_postal_code: billing.zip,
      address_city: billing.city,
      address_street: billing.street,
      address_extra: billing.extra,
      shipping_country: shipping.country,
      shipping_postal_code: shipping.zip,
      shipping_city: shipping.city,
      shipping_street: shipping.street,
      shipping_extra: shipping.extra,
      has_shipping_address: profile.shipping_address ? "1" : "",
      user_type: profile.user_type === "company" ? "company" : "private",
      company_name: profile.company_name ?? "",
      tax_number: profile.tax_number ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return Response.json({ ok: false, error: "Hiányzó bearer token." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return Response.json({ ok: false, error: "Érvénytelen token." }, { status: 401 });
    }
    const user = authData.user;

    const { data: current, error: curErr } = await supabase
      .from("profiles")
      .select("user_type, shipping_address, company_name, tax_number")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (curErr) {
      return Response.json({ ok: false, error: curErr.message }, { status: 500 });
    }

    const body = (await request.json()) as Record<string, string | undefined>;

    const first = String(body.first_name ?? "").trim();
    const last = String(body.last_name ?? "").trim();
    const name = `${first} ${last}`.trim() || null;

    const billingAddr = {
      ...emptyAddr(),
      country: String(body.address_country ?? "Magyarország").trim() || "Magyarország",
      zip: String(body.address_postal_code ?? "").trim(),
      city: String(body.address_city ?? "").trim(),
      street: String(body.address_street ?? "").trim(),
      extra: String(body.address_extra ?? "").trim(),
    };
    const billing_address = formatAddr(billingAddr);

    // Ha a kérésben van shipping mező, frissítjük; ha nincs egyetlen shipping mező sem küldve, megtartjuk a régit
    const hasShippingFields = ["shipping_country", "shipping_postal_code", "shipping_city", "shipping_street", "shipping_extra"].some(
      (k) => body[k] !== undefined,
    );
    let shipping_address: string | null;
    if (hasShippingFields) {
      const shippingAddr = {
        ...emptyAddr(),
        country: String(body.shipping_country ?? "Magyarország").trim() || "Magyarország",
        zip: String(body.shipping_postal_code ?? "").trim(),
        city: String(body.shipping_city ?? "").trim(),
        street: String(body.shipping_street ?? "").trim(),
        extra: String(body.shipping_extra ?? "").trim(),
      };
      shipping_address = formatAddr(shippingAddr);
    } else {
      shipping_address = current?.shipping_address != null ? String(current.shipping_address) : null;
    }

    const userTypeRaw = String(body.user_type ?? current?.user_type ?? "private").toLowerCase();
    const effectiveUserType = userTypeRaw === "company" ? "company" : "private";

    let company_name: string | null =
      body.company_name !== undefined ? String(body.company_name).trim() || null : (current?.company_name ?? null);
    let tax_number: string | null =
      body.tax_number !== undefined ? String(body.tax_number).trim() || null : (current?.tax_number ?? null);

    if (effectiveUserType === "company") {
      if (!company_name) {
        return Response.json({ ok: false, error: "Céges fióknál a cégnév kötelező." }, { status: 400 });
      }
      if (!tax_number) {
        return Response.json({ ok: false, error: "Céges fióknál az adószám kötelező." }, { status: 400 });
      }
    } else {
      company_name = null;
      tax_number = null;
    }

    const patch = {
      auth_user_id: user.id,
      updated_at: new Date().toISOString(),
      user_type: effectiveUserType,
      name,
      phone: String(body.phone ?? "").trim() || null,
      company_name,
      tax_number,
      billing_address,
      shipping_address,
    };

    const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "auth_user_id" });
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
