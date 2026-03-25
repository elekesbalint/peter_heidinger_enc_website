import { requireAdmin } from "@/lib/admin-guard";
import { isDeviceCategory, type DeviceCategoryValue } from "@/lib/device-categories";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const STATUSES = new Set(["available", "assigned", "sold", "archived"]);

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    id?: string;
    identifier?: string;
    category?: string;
    status?: string;
    license_plate?: string | null;
    auth_user_id?: string | null;
  };

  const id = (body.id ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, error: "Hianyzo id." }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};

  if (body.identifier !== undefined) {
    const v = String(body.identifier).trim();
    if (!v) {
      return Response.json({ ok: false, error: "Azonosito nem lehet ures." }, { status: 400 });
    }
    patch.identifier = v;
  }
  if (body.category !== undefined) {
    const c = String(body.category).trim().toLowerCase();
    if (!isDeviceCategory(c)) {
      return Response.json({ ok: false, error: "Ervenytelen kategoria." }, { status: 400 });
    }
    patch.category = c;
  }
  if (body.status !== undefined) {
    const s = String(body.status).trim().toLowerCase();
    if (!STATUSES.has(s)) {
      return Response.json({ ok: false, error: "Ervenytelen statusz." }, { status: 400 });
    }
    patch.status = s;
  }
  if (body.license_plate !== undefined) {
    const lp = body.license_plate === null ? null : String(body.license_plate).trim().toUpperCase() || null;
    patch.license_plate = lp;
  }
  if (body.auth_user_id !== undefined) {
    patch.auth_user_id =
      body.auth_user_id === null || body.auth_user_id === ""
        ? null
        : String(body.auth_user_id).trim();
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, error: "Nincs frissitendo mezo." }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("devices").update(patch).eq("id", id);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
