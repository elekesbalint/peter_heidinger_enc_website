import { randomUUID } from "crypto";

import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { getDevicePriceHuf, type DeviceCategoryValue } from "@/lib/device-categories";
import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBaseUrl, getStripe } from "@/lib/stripe";

const RESERVATION_TTL_HOURS = 48;

type WaitlistItem = {
  id: string;
  auth_user_id: string;
  user_email: string | null;
  category: DeviceCategoryValue;
};

type DeviceItem = {
  id: string;
  identifier: string;
  category: DeviceCategoryValue;
};

async function resolveAuthUserIdByEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string | null | undefined,
  fallbackAuthUserId: string,
): Promise<string> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return fallbackAuthUserId;
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return fallbackAuthUserId;
    const hit = (data?.users ?? []).find((u) => (u.email ?? "").trim().toLowerCase() === normalized);
    return hit?.id ?? fallbackAuthUserId;
  } catch {
    return fallbackAuthUserId;
  }
}

function toStripeHufAmount(hufAmount: number): number {
  return hufAmount * 100;
}

function formatExpiryLabel(iso: string): string {
  const dt = new Date(iso);
  return dt.toLocaleString("hu-HU", { hour12: false });
}

export async function releaseExpiredDeviceReservations(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: expiredRows, error: expiredErr } = await supabase
    .from("device_payment_reservations")
    .select("id, device_id, stripe_session_id")
    .is("paid_at", null)
    .is("cancelled_at", null)
    .lt("expires_at", nowIso);

  if (expiredErr) {
    throw new Error(expiredErr.message);
  }

  const rows = expiredRows ?? [];
  if (rows.length === 0) return 0;

  const stripe = getStripe();
  for (const row of rows) {
    if (!row.stripe_session_id) continue;
    try {
      await stripe.checkout.sessions.expire(row.stripe_session_id);
    } catch {
      // Session may already be completed/expired; this is safe to ignore.
    }
  }

  const deviceIds = Array.from(
    new Set(
      rows
        .map((r) => r.device_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  if (deviceIds.length > 0) {
    const { error: devErr } = await supabase
      .from("devices")
      .update({
        status: "available",
        assigned_at: null,
        updated_at: nowIso,
      })
      .in("id", deviceIds)
      .eq("status", "assigned");
    if (devErr) throw new Error(devErr.message);
  }

  const reservationIds = rows.map((r) => r.id);
  const { error: resErr } = await supabase
    .from("device_payment_reservations")
    .update({
      cancelled_at: nowIso,
    })
    .in("id", reservationIds)
    .is("paid_at", null)
    .is("cancelled_at", null);
  if (resErr) throw new Error(resErr.message);

  return rows.length;
}

export async function createWaitlistPaymentReservation(params: {
  waitlist: WaitlistItem;
  device: DeviceItem;
  adminAuthUserId: string;
  adminEmail: string | null;
}) {
  const { waitlist, device, adminAuthUserId, adminEmail } = params;
  if (!waitlist.user_email) {
    throw new Error("A várólistás felhasználóhoz nincs e-mail cím.");
  }

  const supabase = createSupabaseAdminClient();
  const resolvedAuthUserId = await resolveAuthUserIdByEmail(
    supabase,
    waitlist.user_email,
    waitlist.auth_user_id,
  );
  const settings = await getSettingsMap();
  const referralDiscountHuf = Math.max(
    0,
    getIntSetting(settings, "referral_device_discount_huf", 25000),
  );
  const basePriceHuf = Math.max(
    1,
    getIntSetting(settings, "device_price_huf", getDevicePriceHuf()),
  );
  const { data: activeReferral } = await supabase
    .from("referral_invites")
    .select("id")
    .eq("invited_auth_user_id", waitlist.auth_user_id)
    .is("discount_used_at", null)
    .order("accepted_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const referralWalletBonusHuf = activeReferral
    ? Math.min(basePriceHuf, referralDiscountHuf)
    : 0;
  const payableHuf = basePriceHuf;
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + RESERVATION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const reservationId = randomUUID();

  const stripe = getStripe();
  const baseUrl = getBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: waitlist.user_email,
    success_url: `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/order/cancel`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "huf",
          unit_amount: toStripeHufAmount(payableHuf),
          product_data: {
            name: `AdriaGo ENC keszulek — ${waitlist.category.toUpperCase()} kat.`,
            description: `Eszkoz azonosito: ${device.identifier} (varolista kiosztas)`,
          },
        },
      },
    ],
    metadata: {
      order_type: "device_purchase",
      reservation_id: reservationId,
      source_waitlist_id: waitlist.id,
      user_id: resolvedAuthUserId,
      user_email: waitlist.user_email,
      device_id: device.id,
      device_identifier: device.identifier,
      category: waitlist.category,
      amount_huf: String(payableHuf),
      base_amount_huf: String(basePriceHuf),
      referral_wallet_bonus_huf: String(referralWalletBonusHuf),
      referral_invite_id: activeReferral?.id ?? "",
    },
  });

  if (!session.url) {
    throw new Error("A Stripe nem adott vissza fizetési URL-t.");
  }

  const { data: updatedRows, error: reserveErr } = await supabase
    .from("devices")
    .update({
      status: "assigned",
      assigned_at: nowIso,
      sold_at: null,
      updated_at: nowIso,
      auth_user_id: null,
    })
    .eq("id", device.id)
    .eq("status", "available")
    .select("id");
  if (reserveErr) {
    throw new Error(reserveErr.message);
  }
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("A készüléket közben kiosztották.");
  }

  const { error: reservationErr } = await supabase.from("device_payment_reservations").insert({
    id: reservationId,
    source_waitlist_id: waitlist.id,
    auth_user_id: resolvedAuthUserId,
    user_email: waitlist.user_email,
    category: waitlist.category,
    device_id: device.id,
    device_identifier: device.identifier,
    stripe_session_id: session.id,
    stripe_checkout_url: session.url,
    amount_huf: payableHuf,
    expires_at: expiresAtIso,
    created_by_admin_auth_user_id: adminAuthUserId,
  });
  if (reservationErr) {
    await supabase
      .from("devices")
      .update({
        status: "available",
        assigned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", device.id)
      .eq("status", "assigned");
    throw new Error(reservationErr.message);
  }

  try {
    await sendAppEmail({
      to: waitlist.user_email,
      subject: "AdriaGo — készülék elérhető, fizetési link (48 óra)",
      text: [
        `Jó hír! Elérhetővé vált számodra egy ${waitlist.category.toUpperCase()} kategóriás ENC készülék (${device.identifier}).`,
        `Fizetendő összeg: ${payableHuf.toLocaleString("hu-HU")} Ft.`,
        `Fizetési link (48 óráig él): ${session.url}`,
        `Link lejárata: ${formatExpiryLabel(expiresAtIso)}`,
        "Ha a fizetés nem történik meg időben, a készülék automatikusan visszakerül a szabad készletbe.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
          <h2 style="margin:0 0 12px 0;">Készülék elérhető — fizetési link</h2>
          <p>Elérhetővé vált számodra egy <strong>${waitlist.category.toUpperCase()}</strong> kategóriás ENC készülék (<strong>${device.identifier}</strong>).</p>
          <p>Fizetendő összeg: <strong>${payableHuf.toLocaleString("hu-HU")} Ft</strong></p>
          <p>A fizetési link <strong>48 óráig</strong> érvényes, lejárat: <strong>${formatExpiryLabel(expiresAtIso)}</strong>.</p>
          <p>
            <a href="${session.url}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
              Fizetés megnyitása
            </a>
          </p>
          <p style="font-size:12px;color:#64748b;">Ha nem fizeted ki időben, a készülék automatikusan visszakerül a készletbe.</p>
        </div>
      `,
    });
  } catch (mailError) {
    await supabase.from("device_payment_reservations").delete().eq("id", reservationId);
    await supabase
      .from("devices")
      .update({
        status: "available",
        assigned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", device.id)
      .eq("status", "assigned");
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Ignore session expiry errors during compensation.
    }
    const message = mailError instanceof Error ? mailError.message : "Nem sikerült kiküldeni az e-mailt.";
    throw new Error(message);
  }

  const { error: deleteWaitErr } = await supabase
    .from("device_waitlist")
    .delete()
    .eq("id", waitlist.id);
  if (deleteWaitErr) {
    throw new Error(deleteWaitErr.message);
  }

  const { error: assignmentLogError } = await supabase.from("admin_device_assignments").insert({
    admin_auth_user_id: adminAuthUserId,
    admin_email: adminEmail,
    target_auth_user_id: resolvedAuthUserId,
    target_user_email: waitlist.user_email,
    device_id: device.id,
    device_identifier: device.identifier,
    category: waitlist.category,
    source_waitlist_id: waitlist.id,
    assigned_at: nowIso,
  });
  if (assignmentLogError) {
    throw new Error(assignmentLogError.message);
  }

  return {
    waitlist_id: waitlist.id,
    user_email: waitlist.user_email,
    category: waitlist.category,
    device_identifier: device.identifier,
    checkout_url: session.url,
    expires_at: expiresAtIso,
  };
}
