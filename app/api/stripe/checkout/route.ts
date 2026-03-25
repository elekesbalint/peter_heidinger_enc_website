import {
  applyTopupDiscount,
  getIntSetting,
  getSettingsMap,
  getTopupBlockSmallestCategories,
  getTopupPackagesFromSettings,
  isTopupPackageBlockedForCategory,
} from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth-server";
import { isProfileComplete } from "@/lib/profile-completion";
import { getBaseUrl, getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function toStripeHufAmount(hufAmount: number): number {
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
        { ok: false, error: "A feltolteshez elobb toltsd ki a profil es cimek adatokat a fiokodban." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      baseAmountHuf?: number;
      deviceIdentifier?: string;
      travelDestination?: string;
    };

    const settings = await getSettingsMap();
    const packages = getTopupPackagesFromSettings(settings);
    const discountPct = getIntSetting(settings, "topup_discount_percent", 0);
    const blockedCats = getTopupBlockSmallestCategories(settings);

    const base = body.baseAmountHuf;
    if (typeof base !== "number" || !packages.includes(base)) {
      return Response.json({ ok: false, error: "Ervenytelen csomag osszeg." }, { status: 400 });
    }

    const deviceIdentifier = (body.deviceIdentifier ?? "").trim();
    if (!deviceIdentifier) {
      return Response.json(
        { ok: false, error: "Valassz vagy adj meg keszulek azonositot." },
        { status: 400 },
      );
    }

    const travelDestination = (body.travelDestination ?? "").trim();
    if (travelDestination.length < 2) {
      return Response.json(
        { ok: false, error: "Add meg az uticelt (orszag / regio)." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: ownedDevice, error: ownErr } = await supabase
      .from("devices")
      .select("id, identifier, category")
      .eq("identifier", deviceIdentifier)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (ownErr) {
      return Response.json({ ok: false, error: ownErr.message }, { status: 500 });
    }
    if (!ownedDevice) {
      return Response.json(
        { ok: false, error: "Ez a keszulek nem tartozik a fiokodhoz, vagy nem letezik." },
        { status: 403 },
      );
    }

    if (
      isTopupPackageBlockedForCategory(
        ownedDevice.category as string,
        base,
        packages,
        blockedCats,
      )
    ) {
      const minAllowed = packages[1] ?? packages[0];
      return Response.json(
        {
          ok: false,
          error: `A(z) ${String(ownedDevice.category).toUpperCase()} kategoriahoz legalabb ${minAllowed.toLocaleString("hu-HU")} Ft-os csomag valaszthato.`,
        },
        { status: 400 },
      );
    }

    const chargedHuf = applyTopupDiscount(base, discountPct);

    const stripe = getStripe();
    const baseUrl = getBaseUrl();

    const discountNote =
      discountPct > 0
        ? ` (kedvezmeny ${discountPct}% — fizetendo ${chargedHuf.toLocaleString("hu-HU")} Ft)`
        : "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      success_url: `${baseUrl}/topup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/topup/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "huf",
            unit_amount: toStripeHufAmount(chargedHuf),
            product_data: {
              name: `AdriaGo egyenlegfeltoltes — ${base.toLocaleString("hu-HU")} Ft csomag${discountNote}`,
              description: `Uticel: ${travelDestination}`,
            },
          },
        },
      ],
      metadata: {
        order_type: "topup",
        user_id: user.id,
        user_email: user.email ?? "",
        device_identifier: deviceIdentifier,
        amount_huf: String(chargedHuf),
        base_amount_huf: String(base),
        discount_percent: String(discountPct),
        travel_destination: travelDestination,
      },
    });

    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba tortent.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
