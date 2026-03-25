import { requireAdmin } from "@/lib/admin-guard";
import { isDeviceCategory, type DeviceCategoryValue } from "@/lib/device-categories";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const STATUSES = new Set(["available", "assigned", "sold", "archived"]);

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    identifier?: string;
    category?: string;
    status?: string;
    license_plate?: string | null;
  };

  const identifier = (body.identifier ?? "").trim();
  const category = (body.category ?? "").trim().toLowerCase();
  const status = (body.status ?? "available").trim().toLowerCase();

  if (!identifier || !isDeviceCategory(category)) {
    return Response.json({ ok: false, error: "Ervenytelen azonosito vagy kategoria." }, { status: 400 });
  }
  if (!STATUSES.has(status)) {
    return Response.json({ ok: false, error: "Ervenytelen statusz." }, { status: 400 });
  }

  const license_plate = body.license_plate != null ? String(body.license_plate).trim().toUpperCase() || null : null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("devices")
    .insert({
      identifier,
      category: category as DeviceCategoryValue,
      status,
      license_plate,
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, id: data.id });
}
