import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    user_type?: string | null;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    company_name?: string | null;
    tax_number?: string | null;
    billing_address?: string | null;
    shipping_address?: string | null;
  };

  const id = (body.id ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, error: "Hiányzó user azonosító." }, { status: 400 });
  }

  const normalizedUserType = body.user_type == null ? null : String(body.user_type).trim().toLowerCase();
  if (normalizedUserType && normalizedUserType !== "private" && normalizedUserType !== "company") {
    return Response.json({ ok: false, error: "Érvénytelen fiók típus." }, { status: 400 });
  }
  const companyName = body.company_name == null ? null : String(body.company_name).trim() || null;
  const taxNumber = body.tax_number == null ? null : String(body.tax_number).trim() || null;
  if (normalizedUserType === "company") {
    if (!companyName) {
      return Response.json({ ok: false, error: "Céges fióknál a cégnév kötelező." }, { status: 400 });
    }
    if (!taxNumber) {
      return Response.json({ ok: false, error: "Céges fióknál az adószám kötelező." }, { status: 400 });
    }
  }

  const patch = {
    auth_user_id: id,
    user_type: normalizedUserType,
    name: body.name == null ? null : String(body.name).trim() || null,
    phone: body.phone == null ? null : String(body.phone).trim() || null,
    company_name: normalizedUserType === "company" ? companyName : null,
    tax_number: normalizedUserType === "company" ? taxNumber : null,
    billing_address:
      body.billing_address == null ? null : String(body.billing_address).trim() || null,
    shipping_address:
      body.shipping_address == null ? null : String(body.shipping_address).trim() || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = createSupabaseAdminClient();
  if (body.email !== undefined) {
    const normalizedEmail = body.email == null ? "" : String(body.email).trim().toLowerCase();
    if (!normalizedEmail) {
      return Response.json({ ok: false, error: "Az e-mail cím nem lehet üres." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return Response.json({ ok: false, error: "Érvénytelen e-mail cím." }, { status: 400 });
    }
    const { error: authErr } = await supabase.auth.admin.updateUserById(id, {
      email: normalizedEmail,
      email_confirm: true,
    });
    if (authErr) {
      return Response.json({ ok: false, error: authErr.message }, { status: 400 });
    }
  }
  const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "auth_user_id" });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

