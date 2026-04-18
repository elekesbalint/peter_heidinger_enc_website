/**
 * Barion IPN (Instant Payment Notification) callback handler.
 *
 * Barion POST-ol ide amikor a fizetés állapota megváltozik.
 * A kérés body-jában `paymentId` érkezik (URL-encoded form body).
 * Mi visszahívjuk a Barion API-t a pontos státuszért, majd feldolgozzuk.
 *
 * Ref: https://docs.barion.com/IPN
 */

import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { buildEmailHtml } from "@/lib/email-html";
import { createEracuniInvoice } from "@/lib/eracuni";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendAppEmail } from "@/lib/notify-email";
import { getBarionPaymentState } from "@/lib/barion";

type BarionMeta = {
  order_type: "device_purchase" | "topup";
  user_id: string | null;
  user_email: string | null;
  device_id?: string | null;
  device_identifier: string | null;
  category?: string | null;
  amount_huf: number;
  charged_huf?: number;
  amount_eur?: number;
  license_plate?: string | null;
  referral_wallet_bonus_huf?: number;
  referral_invite_id?: string;
  travel_destination?: string | null;
  fx_eur_to_huf?: number;
  payment_request_id?: string;
  /** Várólistás admin fizetési link — foglalás + eszköz státusz ugyanúgy, mint közvetlen rendelésnél. */
  reservation_id?: string;
};

function parseBillingAddress(raw: string | null | undefined): {
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
} {
  if (!raw?.trim()) return { street: null, postalCode: null, city: null, country: null };
  const parts = raw.split(",").map((s) => s.trim());
  const country = parts[0] || null;
  let zip: string | null = null;
  let city: string | null = null;
  let street: string | null = null;
  if (parts.length >= 3) {
    const zipCity = parts[1] ?? "";
    const spaceIdx = zipCity.indexOf(" ");
    zip = spaceIdx > 0 ? zipCity.slice(0, spaceIdx).trim() || null : zipCity.trim() || null;
    city = spaceIdx > 0 ? zipCity.slice(spaceIdx + 1).trim() || null : null;
    street = parts.slice(2).join(", ").trim() || null;
  } else if (parts.length === 2) {
    street = parts[1] || null;
  }
  return { street, postalCode: zip, city, country };
}

async function fetchProfileBillingAddress(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("billing_address")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    const raw = (data as { billing_address?: string | null } | null)?.billing_address;
    return parseBillingAddress(raw);
  } catch {
    return { street: null, postalCode: null, city: null, country: null };
  }
}

async function resolveAuthUserIdByEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string | null | undefined,
  fallbackAuthUserId: string | null,
): Promise<string | null> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return fallbackAuthUserId;
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return fallbackAuthUserId;
    const hit = (data?.users ?? []).find(
      (u) => (u.email ?? "").trim().toLowerCase() === normalized,
    );
    return hit?.id ?? fallbackAuthUserId;
  } catch {
    return fallbackAuthUserId;
  }
}

async function persistInvoiceLinks(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  paymentId: string,
  kind: "device_sale" | "topup",
  invoiceStatus: "ok" | "skipped" | "failed",
  invoicePublicUrl?: string | null,
  invoicePdfUrl?: string | null,
  invoiceError?: string | null,
) {
  const { data: row } = await supabase
    .from("stripe_topups")
    .select("payload")
    .eq("stripe_session_id", paymentId)
    .maybeSingle();
  const existingPayload =
    row && typeof row.payload === "object" && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {};
  await supabase
    .from("stripe_topups")
    .update({
      payload: {
        ...existingPayload,
        eracuni_invoice: {
          kind,
          status: invoiceStatus,
          public_url: invoicePublicUrl ?? null,
          pdf_url: invoicePdfUrl ?? null,
          error: invoiceError ?? null,
          updated_at: new Date().toISOString(),
        },
      },
    })
    .eq("stripe_session_id", paymentId);
}

export async function POST(request: Request) {
  try {
    // Barion URL-encoded form body-ban küldi a paymentId-t.
    const contentType = request.headers.get("content-type") ?? "";
    let paymentId: string | null = null;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      paymentId = params.get("paymentId");
    } else {
      // Néha JSON-ként érkezik, néha query stringben.
      try {
        const json = (await request.json()) as { paymentId?: string };
        paymentId = json.paymentId ?? null;
      } catch {
        paymentId = null;
      }
    }

    // Query string fallback (Barion néha GET-tel is küld).
    if (!paymentId) {
      const url = new URL(request.url);
      paymentId = url.searchParams.get("paymentId");
    }

    if (!paymentId) {
      return new Response("Missing paymentId", { status: 400 });
    }

    // Barion payment állapot lekérése.
    const state = await getBarionPaymentState(paymentId);

    if (state.Status !== "Succeeded") {
      // Nem sikeres fizetés — nincs teendő (Barion 200-ra vár, különben retry-ol).
      return new Response("ok", { status: 200 });
    }

    const supabase = createSupabaseAdminClient();

    // Pending rekord lekérése.
    const { data: row, error: rowErr } = await supabase
      .from("stripe_topups")
      .select("status, payload, user_id, user_email, device_identifier, amount_huf, currency")
      .eq("stripe_session_id", paymentId)
      .maybeSingle();

    if (rowErr || !row) {
      console.error("[barion-callback] Rekord nem található:", paymentId, rowErr?.message);
      return new Response("ok", { status: 200 });
    }

    // Idempotencia: már feldolgoztuk.
    if (row.status === "paid") {
      return new Response("ok", { status: 200 });
    }

    const payload = (row.payload as Record<string, unknown> | null) ?? {};
    const meta = (payload.barion as BarionMeta | undefined) ?? null;

    if (!meta) {
      console.error("[barion-callback] Hiányzó barion metadata, paymentId:", paymentId);
      return new Response("ok", { status: 200 });
    }

    const paidAt = new Date().toISOString();
    const settings = await getSettingsMap();
    const fxEurToHuf = Math.max(
      1,
      meta.fx_eur_to_huf ?? getIntSetting(settings, "fx_eur_to_huf", 400),
    );
    const amountHuf = meta.amount_huf;
    const userEmail = meta.user_email;
    const deviceIdentifier = meta.device_identifier;

    // Barion payment state-ből vett adatok (számlázáshoz).
    const barionBillingAddr = state.BillingAddress ?? null;
    const payerName = state.PayerInfo?.Name ?? null;
    const payerPhone = state.PayerInfo?.Phone ?? null;

    // stripe_topups frissítése paid státuszra.
    await supabase
      .from("stripe_topups")
      .update({ status: "paid", paid_at: paidAt })
      .eq("stripe_session_id", paymentId);

    // ——————————————————————————————————————————
    // 1) ESZKÖZRENDELÉS
    // ——————————————————————————————————————————
    if (meta.order_type === "device_purchase") {
      const deviceId = meta.device_id ?? null;
      const category = meta.category ?? null;
      const licensePlate = (meta.license_plate ?? "").trim() || null;
      const referralWalletBonusHuf = Math.max(0, meta.referral_wallet_bonus_huf ?? 0);
      const referralInviteId = (meta.referral_invite_id ?? "").trim();
      const reservationId = (meta.reservation_id ?? "").trim();

      const authUserId = await resolveAuthUserIdByEmail(supabase, userEmail, meta.user_id);

      if (!deviceId || !authUserId || !category || !deviceIdentifier) {
        console.error("[barion-callback] Hiányos device_purchase meta:", paymentId);
        return new Response("ok", { status: 200 });
      }

      let updatedRows: Array<{ id: string }> | null = null;
      let deviceUpdateError: { message: string } | null = null;

      if (reservationId) {
        const { data: reservationRow, error: reservationErr } = await supabase
          .from("device_payment_reservations")
          .select("id, expires_at, paid_at, cancelled_at")
          .eq("id", reservationId)
          .maybeSingle();
        if (reservationErr || !reservationRow) {
          console.error("[barion-callback] Foglalás nem található:", reservationErr?.message ?? "");
          return new Response("ok", { status: 200 });
        }
        const expired =
          reservationRow.cancelled_at !== null ||
          reservationRow.paid_at !== null ||
          new Date(reservationRow.expires_at).getTime() < Date.now();
        if (expired) {
          console.error("[barion-callback] Foglalás lejárt vagy már feldolgozva:", reservationId);
          return new Response("ok", { status: 200 });
        }
        const devUpdate = await supabase
          .from("devices")
          .update({
            status: "sold",
            auth_user_id: authUserId,
            sold_at: paidAt,
            updated_at: paidAt,
            license_plate: licensePlate,
          })
          .eq("id", deviceId)
          .in("status", ["assigned", "available"])
          .select("id");
        updatedRows = devUpdate.data as Array<{ id: string }> | null;
        deviceUpdateError = devUpdate.error ? { message: devUpdate.error.message } : null;
        if (!deviceUpdateError && (!updatedRows || updatedRows.length === 0)) {
          const { data: currentDevice, error: currentDeviceErr } = await supabase
            .from("devices")
            .select("id, status, auth_user_id")
            .eq("id", deviceId)
            .maybeSingle();
          if (currentDeviceErr) {
            console.error("[barion-callback] Eszköz újraellenőrzés hiba:", currentDeviceErr.message);
            return new Response("ok", { status: 200 });
          }
          const alreadyAssignedToUser =
            currentDevice?.status === "sold" && currentDevice?.auth_user_id === authUserId;
          if (alreadyAssignedToUser) {
            updatedRows = [{ id: String(currentDevice.id) }];
          } else {
            console.error(
              "[barion-callback] Foglalásos fizetés OK, de eszköz hozzárendelés sikertelen:",
              paymentId,
            );
            return new Response("ok", { status: 200 });
          }
        }
        if (!deviceUpdateError) {
          await supabase
            .from("device_payment_reservations")
            .update({ paid_at: paidAt })
            .eq("id", reservationId)
            .is("cancelled_at", null);
        }
      } else {
        const devUpdate = await supabase
          .from("devices")
          .update({
            status: "sold",
            auth_user_id: authUserId,
            sold_at: paidAt,
            updated_at: paidAt,
            license_plate: licensePlate,
          })
          .eq("id", deviceId)
          .eq("status", "available")
          .select("id");
        updatedRows = devUpdate.data as Array<{ id: string }> | null;
        deviceUpdateError = devUpdate.error ? { message: devUpdate.error.message } : null;
      }

      if (deviceUpdateError) {
        console.error("[barion-callback] Device update hiba:", deviceUpdateError.message);
        return new Response("ok", { status: 200 });
      }

      const assignmentOk = Array.isArray(updatedRows) && updatedRows.length > 0;

      await supabase.from("enc_device_orders").upsert(
        {
          stripe_session_id: paymentId,
          auth_user_id: authUserId,
          user_email: userEmail,
          device_id: deviceId,
          device_identifier: deviceIdentifier,
          category,
          amount_huf: amountHuf,
          status: "paid",
          assignment_ok: assignmentOk,
          paid_at: paidAt,
        },
        { onConflict: "stripe_session_id", ignoreDuplicates: false },
      );

      // Ajánlói wallet bónusz.
      if (referralWalletBonusHuf > 0 && referralInviteId && deviceIdentifier && assignmentOk) {
        await supabase.rpc("apply_topup", {
          p_device_identifier: deviceIdentifier,
          p_amount_huf: referralWalletBonusHuf,
          p_stripe_session_id: `${paymentId}:referral_bonus`,
          p_user_email: userEmail ?? "",
        });
      }

      if (referralInviteId && assignmentOk) {
        await supabase
          .from("referral_invites")
          .update({ status: "discounted", discount_used_at: paidAt })
          .eq("id", referralInviteId)
          .eq("invited_auth_user_id", authUserId)
          .is("discount_used_at", null);
      }

      // e-racuni számla.
      if (deviceIdentifier) {
        const profileAddr = await fetchProfileBillingAddress(supabase, authUserId);
        const inv = await createEracuniInvoice({
          kind: "device_sale",
          deviceIdentifier,
          amountHuf,
          stripePaidMajorUnits: amountHuf,
          stripeCurrency: "HUF",
          paymentMethodForInvoice: "Barion",
          buyerName: payerName,
          buyerStreet: profileAddr.street ?? barionBillingAddr?.Street ?? null,
          buyerPostalCode: profileAddr.postalCode ?? barionBillingAddr?.Zip ?? null,
          buyerCity: profileAddr.city ?? barionBillingAddr?.City ?? null,
          buyerCountryCode: barionBillingAddr?.Country ?? null,
          buyerPhone: payerPhone,
          userEmail,
        });
        const invoiceStatus = inv.ok ? (inv.skipped ? "skipped" : "ok") : "failed";
        await persistInvoiceLinks(
          supabase,
          paymentId,
          "device_sale",
          invoiceStatus,
          inv.invoicePublicUrl,
          inv.invoicePdfUrl,
          inv.error ?? null,
        );
      }

      // Email a felhasználónak.
      if (userEmail) {
        const bonusLine =
          referralWalletBonusHuf > 0
            ? ` Ajánlói jóváírás a készülék egyenlegén: ${referralWalletBonusHuf.toLocaleString("hu-HU")} Ft.`
            : "";
        await sendAppEmail({
          to: userEmail,
          subject: "AdriaGo — sikeres ENC rendelés",
          text: `Köszönjük a vásárlást. Eszköz: ${deviceIdentifier ?? "-"}. Fizetett összeg: ${amountHuf} Ft.${bonusLine}`,
          html: buildEmailHtml({
            title: "Sikeres rendelés",
            intro:
              referralWalletBonusHuf > 0
                ? "Köszönjük a vásárlást, a rendelésedet sikeresen rögzítettük. Az ajánlói induló egyenleg a megvásárolt készülék walletjébe került jóváírásra."
                : "Köszönjük a vásárlást, a rendelésedet sikeresen rögzítettük.",
            rows: [
              { label: "Eszköz", value: deviceIdentifier ?? "-" },
              { label: "Fizetett összeg", value: `${amountHuf.toLocaleString("hu-HU")} Ft` },
              ...(referralWalletBonusHuf > 0
                ? [
                    {
                      label: "Induló egyenleg (ajánló)",
                      value: `${referralWalletBonusHuf.toLocaleString("hu-HU")} Ft`,
                    },
                  ]
                : []),
              { label: "Rendelés azonosító", value: paymentId },
            ],
          }),
        }).catch((err) => {
          console.error("[barion] Rendelés email hiba:", err);
        });
      }

      // Admin email.
      const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
      if (adminEmail) {
        await sendAppEmail({
          to: adminEmail,
          subject: "AdriaGo admin — új ENC rendelés",
          text: `Rendelés: ${deviceIdentifier}, ${userEmail}, ${amountHuf} Ft.`,
          html: buildEmailHtml({
            title: "Új ENC rendelés",
            intro: "Új sikeres rendelés érkezett a rendszerbe.",
            rows: [
              { label: "Felhasználó", value: userEmail ?? "-" },
              { label: "Eszköz", value: deviceIdentifier ?? "-" },
              { label: "Fizetett összeg", value: `${amountHuf.toLocaleString("hu-HU")} Ft` },
              { label: "Barion PaymentId", value: paymentId },
            ],
          }),
        }).catch((err) => {
          console.error("[barion] Admin rendelés email hiba:", err);
        });
      }
    }

    // ——————————————————————————————————————————
    // 2) FELTÖLTÉS
    // ——————————————————————————————————————————
    else if (meta.order_type === "topup") {
      if (!deviceIdentifier) {
        console.error("[barion-callback] Hiányzó device_identifier (topup):", paymentId);
        return new Response("ok", { status: 200 });
      }

      const { error: walletApplyError } = await supabase.rpc("apply_topup", {
        p_device_identifier: deviceIdentifier,
        p_amount_huf: amountHuf,
        p_stripe_session_id: paymentId,
        p_user_email: userEmail,
      });

      if (walletApplyError) {
        console.error("[barion-callback] Wallet apply hiba:", walletApplyError.message);
        return new Response("ok", { status: 200 });
      }

      const topupAuthUserId = await resolveAuthUserIdByEmail(
        supabase,
        userEmail,
        meta.user_id,
      );
      const topupProfileAddr = topupAuthUserId
        ? await fetchProfileBillingAddress(supabase, topupAuthUserId)
        : { street: null, postalCode: null, city: null, country: null };

      const inv = await createEracuniInvoice({
        kind: "topup",
        deviceIdentifier,
        amountHuf,
        stripePaidMajorUnits: meta.amount_eur ?? amountHuf / fxEurToHuf,
        stripeCurrency: row.currency ?? "EUR",
        paymentMethodForInvoice: "Barion",
        buyerName: payerName,
        buyerStreet: topupProfileAddr.street ?? barionBillingAddr?.Street ?? null,
        buyerPostalCode: topupProfileAddr.postalCode ?? barionBillingAddr?.Zip ?? null,
        buyerCity: topupProfileAddr.city ?? barionBillingAddr?.City ?? null,
        buyerCountryCode: barionBillingAddr?.Country ?? null,
        buyerPhone: payerPhone,
        userEmail,
      });
      const invoiceStatus = inv.ok ? (inv.skipped ? "skipped" : "ok") : "failed";
      await persistInvoiceLinks(
        supabase,
        paymentId,
        "topup",
        invoiceStatus,
        inv.invoicePublicUrl,
        inv.invoicePdfUrl,
        inv.error ?? null,
      );

      const amountEur = meta.amount_eur ?? Number((amountHuf / fxEurToHuf).toFixed(2));
      const creditedEur = Number((amountHuf / fxEurToHuf).toFixed(2));

      if (userEmail) {
        await sendAppEmail({
          to: userEmail,
          subject: "AdriaGo — sikeres egyenlegfeltöltés",
          text: `Feltöltött összeg: ${creditedEur.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR, eszköz: ${deviceIdentifier}.`,
          html: buildEmailHtml({
            title: "Sikeres egyenlegfeltöltés",
            intro: "A feltöltésed sikeresen jóváírásra került.",
            rows: [
              { label: "Eszköz", value: deviceIdentifier ?? "-" },
              {
                label: "Feltöltött összeg",
                value: `${creditedEur.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`,
              },
              {
                label: "Fizetett összeg",
                value: `${amountEur.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`,
              },
              { label: "Barion PaymentId", value: paymentId },
            ],
          }),
        }).catch((err) => {
          console.error("[barion] Feltöltés email hiba:", err);
        });
      }

      // Alacsony / negatív egyenleg figyelmeztetés.
      const minBal = getIntSetting(settings, "min_balance_warning_huf", 5000);
      const { data: w } = await supabase
        .from("device_wallets")
        .select("balance_huf")
        .eq("device_identifier", deviceIdentifier)
        .maybeSingle();
      const bal = w ? Number(w.balance_huf) : amountHuf;

      if (userEmail && bal < minBal) {
        await sendAppEmail({
          to: userEmail,
          subject: "AdriaGo — alacsony egyenleg",
          text: `Az eszköz (${deviceIdentifier}) egyenlege: ${bal} Ft (küszöb: ${minBal} Ft).`,
          html: buildEmailHtml({
            title: "Alacsony egyenleg",
            intro: "Az eszközöd egyenlege a beállított figyelmeztetési küszöb alá csökkent.",
            rows: [
              { label: "Eszköz", value: deviceIdentifier ?? "-" },
              { label: "Jelenlegi egyenleg", value: `${bal} Ft` },
              { label: "Figyelmeztetési küszöb", value: `${minBal} Ft` },
            ],
          }),
        }).catch((err) => {
          console.error("[barion] Alacsony egyenleg email hiba:", err);
        });
      }

      if (userEmail && bal < 0) {
        await sendAppEmail({
          to: userEmail,
          subject: "AdriaGo — negatív egyenleg",
          text: `Figyelem: ${deviceIdentifier} egyenlege negatív: ${bal} Ft.`,
          html: buildEmailHtml({
            title: "Negatív egyenleg",
            intro: "Figyelem: az eszközöd egyenlege negatívba fordult.",
            rows: [
              { label: "Eszköz", value: deviceIdentifier ?? "-" },
              { label: "Jelenlegi egyenleg", value: `${bal} Ft` },
              { label: "Felhasználó", value: userEmail },
            ],
          }),
        }).catch((err) => {
          console.error("[barion] Negatív egyenleg email hiba:", err);
        });
        const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
        if (adminEmail) {
          await sendAppEmail({
            to: adminEmail,
            subject: "AdriaGo admin — negatív wallet",
            text: `${deviceIdentifier} / ${userEmail}: ${bal} Ft`,
            html: buildEmailHtml({
              title: "Negatív wallet riasztás",
              intro: "Egy felhasználói eszköz egyenlege negatívba fordult.",
              rows: [
                { label: "Felhasználó", value: userEmail ?? "-" },
                { label: "Eszköz", value: deviceIdentifier ?? "-" },
                { label: "Egyenleg", value: `${bal} Ft` },
              ],
            }),
          }).catch((err) => {
            console.error("[barion] Negatív egyenleg admin email hiba:", err);
          });
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Callback hiba";
    console.error("[barion-callback] Váratlan hiba:", message);
    // 200-t adunk vissza, hogy Barion ne retry-oljon.
    return new Response("ok", { status: 200 });
  }
}

// Barion néha GET-tel is küld IPN-t — fogadjuk azt is.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId");
  if (!paymentId) return new Response("ok", { status: 200 });

  const fakeBody = new URLSearchParams({ paymentId }).toString();
  const fakeRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: fakeBody,
  });
  return POST(fakeRequest);
}
