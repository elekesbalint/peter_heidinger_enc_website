import {
  applyTopupDiscount,
  getFloatSetting,
  getIntSetting,
  getSettingsMap,
  getTopupPackagesFromSettings,
} from "@/lib/app-settings";
import { isProfileComplete } from "@/lib/profile-completion";
import { getBaseUrl, getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function toStripeEurAmount(eurAmount: number): number {
  return Math.round(eurAmount * 100);
}

export async function POST(request: Request) {
  try {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return Response.json({ ok: false, error: "Hiányzó bearer token." }, { status: 401 });
    }
    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return Response.json({ ok: false, error: "Érvénytelen token." }, { status: 401 });
    }
    const user = authData.user;

    if (!(await isProfileComplete(user.id))) {
      return Response.json({ ok: false, error: "A feltöltés előtt töltsd ki a profil és címadatokat." }, { status: 400 });
    }

    const body = (await request.json()) as {
      topupAmountEur?: number;
      selectedPackageEur?: number | null;
      deviceIdentifier?: string;
      travelDestination?: string;
    };
    const settings = await getSettingsMap();
    const packages = getTopupPackagesFromSettings(settings);
    const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));

    const base = body.topupAmountEur;
    if (!Number.isFinite(base) || Number(base) <= 0) {
      return Response.json({ ok: false, error: "Érvénytelen feltöltési összeg." }, { status: 400 });
    }
    const amountEur = Number(Number(base).toFixed(2));
    if (amountEur < 5) {
      return Response.json({ ok: false, error: "Minimum feltöltés: 5 EUR." }, { status: 400 });
    }

    const deviceIdentifier = (body.deviceIdentifier ?? "").trim();
    if (!deviceIdentifier) {
      return Response.json({ ok: false, error: "Készülék azonosító megadása kötelező." }, { status: 400 });
    }
    const travelDestination = (body.travelDestination ?? "").trim();
    if (travelDestination.length < 2) {
      return Response.json({ ok: false, error: "Úticél megadása kötelező." }, { status: 400 });
    }

    const { data: ownedDevice, error: ownErr } = await supabase
      .from("devices")
      .select("id, identifier, category")
      .eq("identifier", deviceIdentifier)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (ownErr) return Response.json({ ok: false, error: ownErr.message }, { status: 500 });
    if (!ownedDevice) {
      return Response.json({ ok: false, error: "A készülék nem a te fiókodhoz tartozik." }, { status: 403 });
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
    const hasPricedListDestination = Boolean(destinationRow && destinationRequiredEur > 0);
    let minTopupRequiredEur = Math.max(0, Number((destinationRequiredEur - currentBalanceEur).toFixed(2)));
    const customDestinationMinFloor = Math.max(
      0,
      Number(getFloatSetting(settings, "topup_custom_destination_min_eur", 30).toFixed(2)),
    );
    if (!hasPricedListDestination && customDestinationMinFloor > 0) {
      minTopupRequiredEur = Math.max(minTopupRequiredEur, customDestinationMinFloor);
    }
    if (amountEur < minTopupRequiredEur) {
      return Response.json(
        {
          ok: false,
          error: hasPricedListDestination
            ? `Legalább ${minTopupRequiredEur.toLocaleString("hu-HU")} EUR feltöltés szükséges ehhez az úticélhoz.`
            : `Egyéni vagy nem árazott úticél esetén legalább ${minTopupRequiredEur.toLocaleString("hu-HU")} EUR feltöltés szükséges.`,
        },
        { status: 400 },
      );
    }

    const selectedPackageEur = Number(body.selectedPackageEur ?? Number.NaN);
    const packageMatch = Number.isFinite(selectedPackageEur)
      ? packages.some((p) => Math.abs(Number(p) - selectedPackageEur) < 0.001)
      : false;
    const selectedPackageMatchesAmount =
      Number.isFinite(selectedPackageEur) && Math.abs(amountEur - selectedPackageEur) < 0.001;
    const discountSetting = Math.max(0, getIntSetting(settings, "topup_discount_percent", 0));
    const applyPackageDiscount = packageMatch && selectedPackageMatchesAmount;
    const appliedDiscountPct = applyPackageDiscount ? discountSetting : 0;
    const chargedEur = applyPackageDiscount
      ? Number(applyTopupDiscount(amountEur, appliedDiscountPct).toFixed(2))
      : amountEur;
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
      customer_email: user.email ?? undefined,
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
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
    const message = error instanceof Error ? error.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

