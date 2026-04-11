import { getCurrentUser } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "auth_user_id, user_type, name, phone, company_name, tax_number, billing_address, shipping_address, updated_at",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metadataUserType =
    String(metadata.user_type ?? "").toLowerCase() === "company" ? "company" : "private";
  const metadataCompanyName = String(metadata.company_name ?? "").trim() || null;
  const metadataTaxNumber = String(metadata.tax_number ?? "").trim() || null;

  return Response.json({
    ok: true,
    profile: data ?? {
      auth_user_id: user.id,
      user_type: metadataUserType,
      name: null,
      phone: null,
      company_name: metadataUserType === "company" ? metadataCompanyName : null,
      tax_number: metadataUserType === "company" ? metadataTaxNumber : null,
      billing_address: null,
      shipping_address: null,
      updated_at: null,
    },
    email: user.email ?? null,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }
  const supabase = createSupabaseAdminClient();

  const body = (await request.json()) as {
    user_type?: string;
    name?: string | null;
    phone?: string | null;
    company_name?: string | null;
    tax_number?: string | null;
    billing_address?: string | null;
    shipping_address?: string | null;
  };

  const patch: Record<string, string | null> = {
    auth_user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  let effectiveUserType: "private" | "company" | null = null;
  if (body.user_type !== undefined) {
    const t = String(body.user_type).toLowerCase();
    if (t !== "private" && t !== "company") {
      return Response.json({ ok: false, error: "user_type: private vagy company." }, { status: 400 });
    }
    patch.user_type = t;
    effectiveUserType = t;
  } else {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    effectiveUserType = (currentProfile?.user_type === "company" ? "company" : "private");
  }
  if (body.name !== undefined) patch.name = body.name === null ? null : String(body.name).trim() || null;
  if (body.phone !== undefined) patch.phone = body.phone === null ? null : String(body.phone).trim() || null;
  if (body.company_name !== undefined) {
    patch.company_name = body.company_name === null ? null : String(body.company_name).trim() || null;
  }
  if (body.tax_number !== undefined) {
    patch.tax_number = body.tax_number === null ? null : String(body.tax_number).trim() || null;
  }
  if (body.billing_address !== undefined) {
    patch.billing_address =
      body.billing_address === null ? null : String(body.billing_address).trim() || null;
  }
  if (body.shipping_address !== undefined) {
    patch.shipping_address =
      body.shipping_address === null ? null : String(body.shipping_address).trim() || null;
  }

  const companyName = String(
    patch.company_name ??
      body.company_name ??
      "",
  ).trim();
  const taxNumber = String(
    patch.tax_number ??
      body.tax_number ??
      "",
  ).trim();
  if (effectiveUserType === "company") {
    if (!companyName) {
      return Response.json({ ok: false, error: "Céges fióknál a cégnév kötelező." }, { status: 400 });
    }
    if (!taxNumber) {
      return Response.json({ ok: false, error: "Céges fióknál az adószám kötelező." }, { status: 400 });
    }
  } else {
    patch.company_name = null;
    patch.tax_number = null;
  }

  const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "auth_user_id" });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
