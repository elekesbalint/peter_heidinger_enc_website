import { requireAdmin } from "@/lib/admin-guard";
import { parseDevicesCsv } from "@/lib/devices-csv";
import { isDeviceCategory } from "@/lib/device-categories";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const g = await requireAdmin();
    if (!g.ok) return g.response;

    const supabase = createSupabaseAdminClient();
    const formData = await request.formData();
    const file = formData.get("file");
    const categoryRaw = String(formData.get("category") ?? "").trim().toLowerCase();

    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: "A 'file' mező kötelező." },
        { status: 400 },
      );
    }

    const categoryOverride = isDeviceCategory(categoryRaw) ? categoryRaw : undefined;

    const content = await file.text();
    const rows = parseDevicesCsv(content, { categoryOverride });

    if (rows.length === 0) {
      return Response.json(
        {
          ok: false,
          error: categoryOverride
            ? "A CSV nem tartalmaz importálható azonosítót (üres fájl?)."
            : "A CSV nem tartalmaz importálható eszközt (identifier + kategoria szükséges, vagy válassz kategóriát a legördülőből).",
        },
        { status: 400 },
      );
    }

    const insertData = rows.map((row) => ({
      identifier: row.identifier,
      category: row.category,
      status: "available",
    }));

    const { count: beforeCount, error: beforeCountError } = await supabase
      .from("devices")
      .select("id", { count: "exact", head: true });
    if (beforeCountError) throw beforeCountError;

    const { error: upsertError } = await supabase.from("devices").upsert(
      insertData,
      {
        onConflict: "identifier",
        ignoreDuplicates: true,
      },
    );
    if (upsertError) throw upsertError;

    const { count: afterCount, error: afterCountError } = await supabase
      .from("devices")
      .select("id", { count: "exact", head: true });
    if (afterCountError) throw afterCountError;

    const inserted = Math.max(0, (afterCount ?? 0) - (beforeCount ?? 0));
    const skipped = Math.max(0, rows.length - inserted);

    return Response.json({
      ok: true,
      fileName: file.name,
      parsedRows: rows.length,
      insertedRows: inserted,
      skippedRows: skipped,
      category: categoryOverride ?? "CSV-ből",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ismeretlen hiba történt.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
