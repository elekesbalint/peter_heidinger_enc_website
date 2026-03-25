import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { parseDevicesCsv } from "@/lib/devices-csv";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
    }
    if (!isAdminEmail(user.email)) {
      return Response.json({ ok: false, error: "Nincs admin jogosultsag." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: "A 'file' mezo kotelezo." },
        { status: 400 },
      );
    }

    const content = await file.text();
    const rows = parseDevicesCsv(content);

    if (rows.length === 0) {
      return Response.json(
        {
          ok: false,
          error:
            "A CSV nem tartalmaz importalhato eszkozt (identifier + kategoria).",
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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ismeretlen hiba tortent.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
