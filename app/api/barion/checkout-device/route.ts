import { getCurrentUser } from "@/lib/auth-server";
import {
  getDevicePriceHuf,
  isDeviceCategory,
  type DeviceCategoryValue,
} from "@/lib/device-categories";
import { isProfileComplete } from "@/lib/profile-completion";
import {
  generatePaymentRequestId,
  getBarionPayee,
  getBaseUrl,
  startBarionPayment,
} from "@/lib/barion";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { releaseExpiredDeviceReservations } from "@/lib/device-waitlist-reservations";
import {
  ORDER_WAITLIST_MESSAGE_SEGMENTS,
  orderWaitlistMessagePlain,
} from "@/lib/order-waitlist-message";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
    }
    if (!(await isProfileComplete(user.id))) {
      return Response.json(
        { ok: false, error: "A rendeléshez előbb töltsd ki a profil és cím adatokat a fiókodban." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      category?: string;
      contractAccepted?: boolean;
      licensePlate?: string;
    };

    if (!body.contractAccepted) {
      return Response.json(
        { ok: false, error: "A szerződés elfogadása kötelező." },
        { status: 400 },
      );
    }

    const category = (body.category ?? "").trim().toLowerCase();
    if (!isDeviceCategory(category)) {
      return Response.json({ ok: false, error: "Érvénytelen kategória." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    await releaseExpiredDeviceReservations();

    const { error: contractError } = await supabase.from("contract_acceptances").insert({
      auth_user_id: user.id,
      user_email: user.email ?? null,
      category: category as DeviceCategoryValue,
      contract_version: "v1",
      context: "device_order",
      accepted_at: new Date().toISOString(),
    });

    if (contractError) {
      return Response.json({ ok: false, error: contractError.message }, { status: 500 });
    }

    const { data: available, error: pickError } = await supabase
      .from("devices")
      .select("id, identifier, category, status")
      .eq("status", "available")
      .eq("category", category as DeviceCategoryValue)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pickError) {
      return Response.json({ ok: false, error: pickError.message }, { status: 500 });
    }

    const licensePlate = (body.licensePlate ?? "").trim().toUpperCase().replace(/\s+/g, "");

    if (!available) {
      const { error: waitError } = await supabase.from("device_waitlist").insert({
        auth_user_id: user.id,
        user_email: user.email ?? null,
        category: category as DeviceCategoryValue,
        note: "Nincs szabad készülék — várólista",
      });
      if (waitError) {
        return Response.json({ ok: false, error: waitError.message }, { status: 500 });
      }
      return Response.json({
        ok: true,
        waitlist: true,
        message: orderWaitlistMessagePlain(),
        waitlistSegments: ORDER_WAITLIST_MESSAGE_SEGMENTS,
      });
    }

    if (licensePlate.length < 5 || licensePlate.length > 12) {
      return Response.json(
        { ok: false, error: "Adj meg érvényes rendszámot (5–12 karakter)." },
        { status: 400 },
      );
    }

    const settings = await getSettingsMap();
    const referralWalletBonusCapHuf = Math.max(
      0,
      getIntSetting(settings, "referral_device_discount_huf", 25000),
    );
    const { data: activeReferral } = await supabase
      .from("referral_invites")
      .select("id")
      .eq("invited_auth_user_id", user.id)
      .is("discount_used_at", null)
      .order("accepted_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const basePriceHuf = Math.max(
      1,
      getIntSetting(settings, "device_price_huf", getDevicePriceHuf()),
    );
    const referralWalletBonusHuf = activeReferral
      ? Math.min(basePriceHuf, referralWalletBonusCapHuf)
      : 0;

    const baseUrl = getBaseUrl();
    const payee = getBarionPayee();
    const paymentRequestId = generatePaymentRequestId("device");

    const barionResult = await startBarionPayment({
      PaymentType: "Immediate",
      GuestCheckOut: true,
      FundingSources: ["All"],
      PaymentRequestId: paymentRequestId,
      Locale: "hu-HU",
      Currency: "HUF",
      RedirectUrl: `${baseUrl}/order/success?barion=1`,
      CallbackUrl: `${baseUrl}/api/barion/callback`,
      PayerHint: user.email ?? undefined,
      Transactions: [
        {
          POSTransactionId: paymentRequestId,
          Payee: payee,
          Total: basePriceHuf,
          Items: [
            {
              Name: `AdriaGo ENC készülék — ${category.toUpperCase()} kat.`,
              Description: `Eszköz azonosító: ${available.identifier}`,
              Quantity: 1,
              Unit: "db",
              UnitPrice: basePriceHuf,
              ItemTotal: basePriceHuf,
              SKU: `enc-device-${category}`,
            },
          ],
        },
      ],
    });

    // Pending rekord tárolása — callback-nél visszakeressük PaymentId alapján.
    const { error: dbError } = await supabase.from("stripe_topups").insert({
      stripe_session_id: barionResult.PaymentId,
      user_id: user.id,
      user_email: user.email ?? null,
      device_identifier: available.identifier,
      amount_huf: basePriceHuf,
      currency: "HUF",
      status: "pending",
      payload: {
        barion: {
          order_type: "device_purchase",
          user_id: user.id,
          user_email: user.email ?? null,
          device_id: available.id,
          device_identifier: available.identifier,
          category,
          amount_huf: basePriceHuf,
          license_plate: licensePlate,
          referral_wallet_bonus_huf: referralWalletBonusHuf,
          referral_invite_id: activeReferral?.id ?? "",
          payment_request_id: paymentRequestId,
        },
      },
    });

    if (dbError) {
      console.error("[barion] Pending device rekord mentése sikertelen:", dbError.message);
    }

    return Response.json({ ok: true, url: barionResult.GatewayUrl, waitlist: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba történt.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
