import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { emptyAddress, formatAddress, parseAddress } from "@/lib/profile-address";

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

    const billing = parseAddress(profile.billing_address);
    const { first, last } = splitName(profile.name);
    const streetLine = [billing.street, billing.extra].filter(Boolean).join(", ");

    return Response.json({
      ok: true,
      email: user.email ?? "",
      first_name: first,
      last_name: last,
      phone: profile.phone ?? "",
      address_country: billing.country,
      address_postal_code: billing.zip,
      address_city: billing.city,
      address_street: streetLine,
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
      ...emptyAddress(),
      country: String(body.address_country ?? "Magyarország").trim() || "Magyarország",
      zip: String(body.address_postal_code ?? "").trim(),
      city: String(body.address_city ?? "").trim(),
      street: String(body.address_street ?? "").trim(),
      extra: "",
    };
    const billing_address = formatAddress(billingAddr);

    const shipping_address =
      current?.shipping_address != null ? String(current.shipping_address) : null;

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
