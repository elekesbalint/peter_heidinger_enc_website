import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { parseEncCsv } from "@/lib/enc-csv";
import { sendAppEmail } from "@/lib/notify-email";
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
    const rows = parseEncCsv(content);

    if (rows.length === 0) {
      return Response.json(
        { ok: false, error: "A CSV nem tartalmaz importalhato sort." },
        { status: 400 },
      );
    }

    const uniqueDeviceNumbers = Array.from(
      new Set(rows.map((row) => row.deviceNumberRaw).filter(Boolean)),
    );

    const { data: devices, error: devicesError } = await supabase
      .from("devices")
      .select("id, identifier, auth_user_id")
      .in("identifier", uniqueDeviceNumbers);
    if (devicesError) throw devicesError;

    const deviceMap = new Map((devices ?? []).map((d) => [d.identifier, d.id]));
    const authUserByIdentifier = new Map(
      (devices ?? []).map((d) => [d.identifier, d.auth_user_id ?? null] as const),
    );
    const settings = await getSettingsMap();
    const minBalanceWarningHuf = getIntSetting(settings, "min_balance_warning_huf", 5000);
    const { data: walletsBefore } = await supabase
      .from("device_wallets")
      .select("device_identifier, balance_huf")
      .in("device_identifier", uniqueDeviceNumbers);
    const oldBalanceByIdentifier = new Map(
      (walletsBefore ?? []).map((w) => [w.device_identifier, Number(w.balance_huf ?? 0)] as const),
    );

    const createData = rows.map((row) => ({
      relation_label: row.relationLabel,
      gate_path: row.gatePath,
      executed_at: row.executedAt.toISOString(),
      entry_at: row.entryAt?.toISOString() ?? null,
      exit_at: row.exitAt?.toISOString() ?? null,
      device_number_raw: row.deviceNumberRaw,
      license_plate: row.licensePlate,
      amount: row.amount,
      currency: row.currency,
      source_file_name: file.name,
      source_line_number: row.sourceLineNumber,
      dedupe_key: row.dedupeKey,
      device_id: deviceMap.get(row.deviceNumberRaw) ?? null,
    }));

    const { count: beforeCount, error: beforeCountError } = await supabase
      .from("route_records")
      .select("id", { count: "exact", head: true });
    if (beforeCountError) throw beforeCountError;

    const { error: upsertError } = await supabase
      .from("route_records")
      .upsert(createData, {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      });
    if (upsertError) throw upsertError;

    const { count: afterCount, error: afterCountError } = await supabase
      .from("route_records")
      .select("id", { count: "exact", head: true });
    if (afterCountError) throw afterCountError;

    const inserted = Math.max(0, (afterCount ?? 0) - (beforeCount ?? 0));
    const skipped = Math.max(0, createData.length - inserted);
    const linkedDeviceRows = createData.filter((row) =>
      Boolean(row.device_id),
    ).length;

    const { data: walletsAfter } = await supabase
      .from("device_wallets")
      .select("device_identifier, balance_huf")
      .in("device_identifier", uniqueDeviceNumbers);
    const newBalanceByIdentifier = new Map(
      (walletsAfter ?? []).map((w) => [w.device_identifier, Number(w.balance_huf ?? 0)] as const),
    );

    const crossedLowIdentifiers = uniqueDeviceNumbers.filter((identifier) => {
      const oldBalance = oldBalanceByIdentifier.get(identifier) ?? 0;
      const newBalance = newBalanceByIdentifier.get(identifier) ?? oldBalance;
      return oldBalance >= minBalanceWarningHuf && newBalance < minBalanceWarningHuf;
    });

    const notifyByAuthUser = new Map<string, { email: string; items: string[] }>();
    for (const identifier of crossedLowIdentifiers) {
      const authUserId = authUserByIdentifier.get(identifier);
      if (!authUserId) continue;
      const userResp = await supabase.auth.admin.getUserById(authUserId);
      const email = userResp.data.user?.email?.trim() ?? "";
      if (!email) continue;
      const prev = notifyByAuthUser.get(authUserId);
      if (prev) prev.items.push(identifier);
      else notifyByAuthUser.set(authUserId, { email, items: [identifier] });
    }

    for (const row of notifyByAuthUser.values()) {
      await sendAppEmail({
        to: row.email,
        subject: "AdriaGo — egyenleg figyelmeztetés",
        text: `Az alábbi eszköz(ök) egyenlege a küszöb alá csökkent: ${row.items.join(", ")}. Kérjük töltsd fel az egyenleget.`,
      }).catch((err) => {
        console.error("[routes-import] low-balance email failed:", err);
      });
    }

    return Response.json({
      ok: true,
      fileName: file.name,
      parsedRows: rows.length,
      insertedRows: inserted,
      skippedRows: skipped,
      linkedDeviceRows,
      warnedUsers: notifyByAuthUser.size,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ismeretlen hiba tortent.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
