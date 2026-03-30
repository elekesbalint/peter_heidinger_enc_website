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
      topupAmountHuf?: number;
      deviceIdentifier?: string;
      travelDestination?: string;
    };

    const settings = await getSettingsMap();
    const packages = getTopupPackagesFromSettings(settings);
    const discountPct = getIntSetting(settings, "topup_discount_percent", 0);
    const blockedCats = getTopupBlockSmallestCategories(settings);

    const base = body.topupAmountHuf;
    if (!Number.isFinite(base) || Number(base) <= 0) {
      return Response.json({ ok: false, error: "Ervenytelen feltoltesi osszeg." }, { status: 400 });
    }
    const amountHuf = Math.floor(Number(base));
    if (amountHuf < 1000) {
      return Response.json({ ok: false, error: "Minimum feltoltes: 1000 Ft." }, { status: 400 });
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
    const currentBalanceHuf = Number(walletRow?.balance_huf ?? 0);

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
    const destinationRequiredHuf = Math.max(0, Math.floor(byCategory[categoryKey] ?? 0));
    const minTopupRequiredHuf = Math.max(0, destinationRequiredHuf - currentBalanceHuf);

    if (minTopupRequiredHuf > 0 && amountHuf < minTopupRequiredHuf) {
      return Response.json(
        {
          ok: false,
          error: `Legalabb ${minTopupRequiredHuf.toLocaleString("hu-HU")} Ft feltoltes szukseges ehhez az uticelhoz.`,
        },
        { status: 400 },
      );
    }

    if (
      minTopupRequiredHuf <= 0 &&
      packages.includes(amountHuf) &&
      isTopupPackageBlockedForCategory(
        ownedDevice.category as string,
        amountHuf,
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

    const discountActive = minTopupRequiredHuf <= 0 && packages.includes(amountHuf);
    const appliedDiscountPct = discountActive ? discountPct : 0;
    const chargedHuf = applyTopupDiscount(amountHuf, appliedDiscountPct);

    const stripe = getStripe();
    const baseUrl = getBaseUrl();

    const discountNote =
      appliedDiscountPct > 0
        ? ` (kedvezmeny ${appliedDiscountPct}% — fizetendo ${chargedHuf.toLocaleString("hu-HU")} Ft)`
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
              name: `AdriaGo egyenlegfeltoltes — ${amountHuf.toLocaleString("hu-HU")} Ft${discountNote}`,
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
        base_amount_huf: String(amountHuf),
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
