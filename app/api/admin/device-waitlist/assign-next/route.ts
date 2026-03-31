import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
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
  created_at: string;
};

type DeviceItem = {
  id: string;
  identifier: string;
  category: DeviceCategoryValue;
};

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return Response.json({ ok: false, error: "Nincs admin jogosultsag." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  try {
    await releaseExpiredDeviceReservations();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nem sikerült a lejárt rezervációk felszabadítása.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }

  const { data: waitlistRows, error: waitlistError } = await supabase
    .from("device_waitlist")
    .select("id, auth_user_id, user_email, category, created_at")
    .order("created_at", { ascending: true })
    .limit(100);

  if (waitlistError) {
    return Response.json({ ok: false, error: waitlistError.message }, { status: 500 });
  }

  const waitlist = (waitlistRows ?? []) as WaitlistItem[];
  if (waitlist.length === 0) {
    return Response.json({
      ok: true,
      assigned: false,
      message: "A varolista ures, nincs mit kiosztani.",
    });
  }

  const { data: availableRows, error: devicesError } = await supabase
    .from("devices")
    .select("id, identifier, category")
    .eq("status", "available")
    .order("created_at", { ascending: true })
    .limit(500);

  if (devicesError) {
    return Response.json({ ok: false, error: devicesError.message }, { status: 500 });
  }

  const availableDevices = (availableRows ?? []) as DeviceItem[];
  if (availableDevices.length === 0) {
    return Response.json({
      ok: true,
      assigned: false,
      message: "Nincs elerheto keszulek, kiosztas nem tortent.",
    });
  }

  const byCategory = new Map<string, DeviceItem[]>();
  for (const device of availableDevices) {
    const list = byCategory.get(device.category) ?? [];
    list.push(device);
    byCategory.set(device.category, list);
  }

  let selectedRequest: WaitlistItem | null = null;
  let selectedDevice: DeviceItem | null = null;

  for (const req of waitlist) {
    const candidates = byCategory.get(req.category) ?? [];
    if (candidates.length > 0) {
      selectedRequest = req;
      selectedDevice = candidates[0];
      break;
    }
  }

  if (!selectedRequest || !selectedDevice) {
    return Response.json({
      ok: true,
      assigned: false,
      message: "Van varolista, de jelenleg nincs megfelelo kategoriaban szabad keszulek.",
    });
  }

  try {
    const item = await createWaitlistPaymentReservation({
      waitlist: selectedRequest,
      device: selectedDevice,
      adminAuthUserId: user.id,
      adminEmail: user.email ?? null,
    });
    return Response.json({
      ok: true,
      assigned: true,
      message: "Fizetési link kiküldve.",
      item,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nem sikerült fizetési linket küldeni.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
