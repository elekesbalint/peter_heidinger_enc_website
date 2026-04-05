import { getCurrentUser } from "@/lib/auth-server";
import {
  getDevicePriceHuf,
  isDeviceCategory,
  type DeviceCategoryValue,
} from "@/lib/device-categories";
import { isProfileComplete } from "@/lib/profile-completion";
import { getBaseUrl, getStripe } from "@/lib/stripe";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { releaseExpiredDeviceReservations } from "@/lib/device-waitlist-reservations";
import {
  ORDER_WAITLIST_MESSAGE_SEGMENTS,
  orderWaitlistMessagePlain,
} from "@/lib/order-waitlist-message";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function toStripeHufAmount(hufAmount: number): number {
  // This Stripe account expects HUF in 1/100 units for Checkout.
  return hufAmount * 100;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
    }
    if (!(await isProfileComplete(user.id))) {
      return Response.json(
        { ok: false, error: "A rendeleshez elobb toltsd ki a profil es cimek adatokat a fiokodban." },
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
        { ok: false, error: "A szerzodes elfogadasa kotelezo." },
        { status: 400 },
      );
    }

    const category = (body.category ?? "").trim().toLowerCase();
    if (!isDeviceCategory(category)) {
      return Response.json({ ok: false, error: "Ervenytelen kategoria." }, { status: 400 });
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
        { ok: false, error: "Adj meg ervenyes rendszamot (5–12 karakter)." },
        { status: 400 },
      );
    }

    const settings = await getSettingsMap();
    const referralDiscountHuf = Math.max(
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
    const appliedReferralDiscountHuf = activeReferral ? Math.min(basePriceHuf, referralDiscountHuf) : 0;
    const priceHuf = Math.max(1, basePriceHuf - appliedReferralDiscountHuf);
    const stripe = getStripe();
    const baseUrl = getBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      success_url: `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/order/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "huf",
            unit_amount: toStripeHufAmount(priceHuf),
            product_data: {
              name: `AdriaGo ENC keszulek — ${category.toUpperCase()} kat.`,
              description: `Eszkoz azonosito: ${available.identifier}`,
            },
          },
        },
      ],
      metadata: {
        order_type: "device_purchase",
        user_id: user.id,
        user_email: user.email ?? "",
        device_id: available.id,
        device_identifier: available.identifier,
        category,
        amount_huf: String(priceHuf),
        base_amount_huf: String(basePriceHuf),
        referral_discount_huf: String(appliedReferralDiscountHuf),
        referral_invite_id: activeReferral?.id ?? "",
        license_plate: licensePlate,
      },
    });

    return Response.json({ ok: true, url: session.url, waitlist: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba tortent.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
