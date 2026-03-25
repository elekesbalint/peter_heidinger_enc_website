import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type WaitlistItem = {
  id: string;
  auth_user_id: string;
  user_email: string | null;
  category: string;
  created_at: string;
};

type DeviceItem = {
  id: string;
  identifier: string;
  category: string;
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

  const assignedAt = new Date().toISOString();
  const { data: updatedRows, error: assignError } = await supabase
    .from("devices")
    .update({
      status: "sold",
      auth_user_id: selectedRequest.auth_user_id,
      assigned_at: assignedAt,
      sold_at: assignedAt,
      updated_at: assignedAt,
    })
    .eq("id", selectedDevice.id)
    .eq("status", "available")
    .select("id")
    .limit(1);

  if (assignError) {
    return Response.json({ ok: false, error: assignError.message }, { status: 500 });
  }

  if (!updatedRows || updatedRows.length === 0) {
    return Response.json({
      ok: true,
      assigned: false,
      message: "A kivalasztott keszuleket kozben lefoglaltak, probald ujra.",
    });
  }

  const { error: deleteWaitlistError } = await supabase
    .from("device_waitlist")
    .delete()
    .eq("id", selectedRequest.id);

  if (deleteWaitlistError) {
    return Response.json({ ok: false, error: deleteWaitlistError.message }, { status: 500 });
  }

  const { error: assignmentLogError } = await supabase.from("admin_device_assignments").insert({
    admin_auth_user_id: user.id,
    admin_email: user.email ?? null,
    target_auth_user_id: selectedRequest.auth_user_id,
    target_user_email: selectedRequest.user_email,
    device_id: selectedDevice.id,
    device_identifier: selectedDevice.identifier,
    category: selectedRequest.category,
    source_waitlist_id: selectedRequest.id,
    assigned_at: assignedAt,
  });

  if (assignmentLogError) {
    return Response.json({ ok: false, error: assignmentLogError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    assigned: true,
    message: "Kiosztas sikeres.",
    item: {
      waitlist_id: selectedRequest.id,
      user_email: selectedRequest.user_email,
      category: selectedRequest.category,
      device_identifier: selectedDevice.identifier,
    },
  });
}
