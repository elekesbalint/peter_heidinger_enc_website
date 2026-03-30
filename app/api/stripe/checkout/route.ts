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

function toStripeEurAmount(eurAmount: number): number {
  return Math.round(eurAmount * 100);
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
      topupAmountEur?: number;
      deviceIdentifier?: string;
      travelDestination?: string;
    };

    const settings = await getSettingsMap();
    const packages = getTopupPackagesFromSettings(settings);
    const discountPct = getIntSetting(settings, "topup_discount_percent", 0);
    const blockedCats = getTopupBlockSmallestCategories(settings);
    const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));

    const base = body.topupAmountEur;
    if (!Number.isFinite(base) || Number(base) <= 0) {
      return Response.json({ ok: false, error: "Ervenytelen feltoltesi osszeg." }, { status: 400 });
    }
    const amountEur = Number(Number(base).toFixed(2));
    if (amountEur < 5) {
      return Response.json({ ok: false, error: "Minimum feltoltes: 5 EUR." }, { status: 400 });
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

    const { data: walletRow } = await supabase
      .from("device_wallets")
      .select("balance_huf")
      .eq("device_identifier", deviceIdentifier)
      .maybeSingle();
    const currentBalanceEur = Number((Number(walletRow?.balance_huf ?? 0) / fxEurToHuf).toFixed(2));

    const { data: destinationRow } = await supabase
      .from("destinations")
      .select("name, price_ia, price_i, price_ii, price_iii, price_iv")
      .eq("name", travelDestination)
      .maybeSingle();

    const categoryKey = String(ownedDevice.category).toLowerCase();
    const byCategory: Record<string, number> = destinationRow
      ? {
          ia: Number(destinationRow.price_ia ?? 0),
          i: Number(destinationRow.price_i ?? 0),
          ii: Number(destinationRow.price_ii ?? 0),
          iii: Number(destinationRow.price_iii ?? 0),
          iv: Number(destinationRow.price_iv ?? 0),
        }
      : {};
    const destinationRequiredEur = Math.max(0, Number(byCategory[categoryKey] ?? 0));
    const minTopupRequiredEur = Math.max(
      0,
      Number((destinationRequiredEur - currentBalanceEur).toFixed(2)),
    );

    if (minTopupRequiredEur > 0 && amountEur < minTopupRequiredEur) {
      return Response.json(
        {
          ok: false,
          error: `Legalabb ${minTopupRequiredEur.toLocaleString("hu-HU")} EUR feltoltes szukseges ehhez az uticelhoz.`,
        },
        { status: 400 },
      );
    }

    if (
      minTopupRequiredEur <= 0 &&
      packages.includes(amountEur) &&
      isTopupPackageBlockedForCategory(
        ownedDevice.category as string,
        amountEur,
        packages,
        blockedCats,
      )
    ) {
      const minAllowed = packages[1] ?? packages[0];
      return Response.json(
        {
          ok: false,
          error: `A(z) ${String(ownedDevice.category).toUpperCase()} kategoriahoz legalabb ${minAllowed.toLocaleString("hu-HU")} EUR-os csomag valaszthato.`,
        },
        { status: 400 },
      );
    }

    const discountActive = minTopupRequiredEur <= 0 && packages.includes(amountEur);
    const appliedDiscountPct = discountActive ? discountPct : 0;
    const chargedEur = applyTopupDiscount(amountEur, appliedDiscountPct);
    const chargedHuf = Math.max(1, Math.round(chargedEur * fxEurToHuf));
    const baseAmountHuf = Math.max(1, Math.round(amountEur * fxEurToHuf));

    const stripe = getStripe();
    const baseUrl = getBaseUrl();

    const discountNote =
      appliedDiscountPct > 0
        ? ` (kedvezmeny ${appliedDiscountPct}% — fizetendo ${chargedEur.toLocaleString("hu-HU")} EUR)`
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
            currency: "eur",
            unit_amount: toStripeEurAmount(chargedEur),
            product_data: {
              name: `AdriaGo egyenlegfeltoltes — ${amountEur.toLocaleString("hu-HU")} EUR${discountNote}`,
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
        // Wallet jóváírás a teljes (kedvezmény előtti) csomagösszeggel történjen.
        amount_huf: String(baseAmountHuf),
        charged_amount_huf: String(chargedHuf),
        base_amount_huf: String(baseAmountHuf),
        amount_eur: String(chargedEur),
        discount_percent: String(appliedDiscountPct),
        travel_destination: travelDestination,
      },
    });

    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba tortent.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
