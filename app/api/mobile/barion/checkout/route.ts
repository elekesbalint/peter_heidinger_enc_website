import {
  applyTopupDiscount,
  getFloatSetting,
  getIntSetting,
  getSettingsMap,
  getTopupPackagesFromSettings,
} from "@/lib/app-settings";
import { isProfileComplete } from "@/lib/profile-completion";
import {
  generatePaymentRequestId,
  getBarionPayee,
  getBaseUrl,
  startBarionPayment,
} from "@/lib/barion";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
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
      return Response.json(
        { ok: false, error: "A feltöltés előtt töltsd ki a profil és cím adatokat." },
        { status: 400 },
      );
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
      return Response.json(
        { ok: false, error: "Készülék azonosító megadása kötelező." },
        { status: 400 },
      );
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
      return Response.json(
        { ok: false, error: "A készülék nem a te fiókodhoz tartozik." },
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
    const hasPricedListDestination = Boolean(destinationRow && destinationRequiredEur > 0);
    let minTopupRequiredEur = Math.max(
      0,
      Number((destinationRequiredEur - currentBalanceEur).toFixed(2)),
    );
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

    const baseUrl = getBaseUrl();
    const payee = getBarionPayee();
    const paymentRequestId = generatePaymentRequestId("mob-topup");
    const discountNote =
      appliedDiscountPct > 0
        ? ` (kedvezmény ${appliedDiscountPct}% — fizetve ${chargedEur.toLocaleString("hu-HU")} EUR)`
        : "";

    const barionResult = await startBarionPayment({
      PaymentType: "Immediate",
      GuestCheckOut: true,
      FundingSources: ["All"],
      PaymentRequestId: paymentRequestId,
      Locale: "hu-HU",
      Currency: "EUR",
      RedirectUrl: `${baseUrl}/topup/success?barion=1`,
      CallbackUrl: `${baseUrl}/api/barion/callback`,
      PayerHint: user.email ?? undefined,
      Transactions: [
        {
          POSTransactionId: paymentRequestId,
          Payee: payee,
          Total: chargedEur,
          Items: [
            {
              Name: `AdriaGo egyenlegfeltöltés — ${amountEur.toLocaleString("hu-HU")} EUR${discountNote}`,
              Description: `Úticél: ${travelDestination}`,
              Quantity: 1,
              Unit: "db",
              UnitPrice: chargedEur,
              ItemTotal: chargedEur,
              SKU: "enc-topup",
            },
          ],
        },
      ],
    });

    const { error: dbError } = await supabase.from("stripe_topups").insert({
      stripe_session_id: barionResult.PaymentId,
      user_id: user.id,
      user_email: user.email ?? null,
      device_identifier: deviceIdentifier,
      amount_huf: baseAmountHuf,
      currency: "EUR",
      status: "pending",
      payload: {
        barion: {
          order_type: "topup",
          user_id: user.id,
          user_email: user.email ?? null,
          device_identifier: deviceIdentifier,
          amount_huf: baseAmountHuf,
          charged_huf: chargedHuf,
          amount_eur: chargedEur,
          discount_percent: appliedDiscountPct,
          travel_destination: travelDestination,
          fx_eur_to_huf: fxEurToHuf,
          payment_request_id: paymentRequestId,
        },
      },
      travel_destination: travelDestination,
    });

    if (dbError) {
      console.error("[barion/mobile] Pending topup rekord mentése sikertelen:", dbError.message);
    }

    return Response.json({ ok: true, url: barionResult.GatewayUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
