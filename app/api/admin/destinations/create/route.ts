import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function num(v: unknown, field: string): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Ervenytelen szam: ${field}`);
  }
  return n;
}

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!name) {
      return Response.json({ ok: false, error: "Nev kotelezo." }, { status: 400 });
    }

    const row = {
      name,
      price_ia: num(body.price_ia, "price_ia"),
      price_i: num(body.price_i, "price_i"),
      price_ii: num(body.price_ii, "price_ii"),
      price_iii: num(body.price_iii, "price_iii"),
      price_iv: num(body.price_iv, "price_iv"),
    };

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("destinations").insert(row).select("id").single();
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, id: data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hiba";
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
