import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    price_ia?: number;
    price_i?: number;
    price_ii?: number;
    price_iii?: number;
    price_iv?: number;
  };

  const id = (body.id ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, error: "Hianyzo id." }, { status: 400 });
  }

  const patch: Record<string, string | number> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) return Response.json({ ok: false, error: "Nev nem lehet ures." }, { status: 400 });
    patch.name = n;
  }
  for (const key of ["price_ia", "price_i", "price_ii", "price_iii", "price_iv"] as const) {
    if (body[key] !== undefined) {
      const v = Number(body[key]);
      if (!Number.isFinite(v) || v < 0) {
        return Response.json({ ok: false, error: `Ervenytelen ${key}` }, { status: 400 });
      }
      patch[key] = v;
    }
  }

  if (Object.keys(patch).length <= 1) {
    return Response.json({ ok: false, error: "Nincs frissitendo mezo." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("destinations").update(patch).eq("id", id);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
