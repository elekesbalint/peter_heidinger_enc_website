import { requireAdmin } from "@/lib/admin-guard";
import type { DeviceCategoryValue } from "@/lib/device-categories";
import {
  createWaitlistPaymentReservation,
  releaseExpiredDeviceReservations,
} from "@/lib/device-waitlist-reservations";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type WaitlistItem = {
  id: string;
  auth_user_id: string;
  user_email: string | null;
  category: DeviceCategoryValue;
};

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  const adminUser = g.user;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const waitlistId = (body.id ?? "").trim();
  if (!waitlistId) {
    return Response.json({ ok: false, error: "Hiányzó várólista azonosító." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  try {
    await releaseExpiredDeviceReservations();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nem sikerült a lejárt rezervációk felszabadítása.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
  const { data: req, error: reqErr } = await supabase
    .from("device_waitlist")
    .select("id, auth_user_id, user_email, category")
    .eq("id", waitlistId)
    .maybeSingle<WaitlistItem>();
  if (reqErr || !req) {
    return Response.json({ ok: false, error: "Várólista elem nem található." }, { status: 404 });
  }

  const { data: device, error: devErr } = await supabase
    .from("devices")
    .select("id, identifier")
    .eq("status", "available")
    .eq("category", req.category)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (devErr) {
    return Response.json({ ok: false, error: devErr.message }, { status: 500 });
  }
  if (!device) {
    return Response.json(
      { ok: false, error: "Nincs szabad készülék ebben a kategóriában." },
      { status: 400 },
    );
  }

  try {
    const item = await createWaitlistPaymentReservation({
      waitlist: req as WaitlistItem,
      device: {
        id: String(device.id),
        identifier: String(device.identifier),
        category: req.category,
      },
      adminAuthUserId: adminUser.id,
      adminEmail: adminUser.email ?? null,
    });

    return Response.json({
      ok: true,
      item,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nem sikerült fizetési linket küldeni.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

