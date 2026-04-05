import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { buildEmailHtml } from "@/lib/email-html";
import { createEracuniInvoiceStub } from "@/lib/eracuni";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendAppEmail } from "@/lib/notify-email";
import { getStripe } from "@/lib/stripe";

function parseAmountHuf(sessionAmountTotal: number | null, metadataAmountHuf: string | undefined): number {
  const metaAmount = metadataAmountHuf ? Number.parseInt(metadataAmountHuf, 10) : NaN;
  if (Number.isFinite(metaAmount) && metaAmount > 0) {
    return metaAmount;
  }

  const total = sessionAmountTotal ?? 0;
  return Math.round(total / 100);
}

function parseAmountEur(
  sessionAmountTotal: number | null,
  metadataAmountEur: string | undefined,
): number {
  const metaAmount = metadataAmountEur
    ? Number.parseFloat(metadataAmountEur)
    : NaN;
  if (Number.isFinite(metaAmount) && metaAmount > 0) {
    return Math.round(metaAmount * 100) / 100;
  }

  const total = sessionAmountTotal ?? 0;
  return Math.round(total) / 100;
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
    const hit = (data?.users ?? []).find((u) => (u.email ?? "").trim().toLowerCase() === normalized);
    return hit?.id ?? fallbackAuthUserId;
  } catch {
    return fallbackAuthUserId;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  const rawBody = await request.text();

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const supabase = createSupabaseAdminClient();

      const metadata = session.metadata ?? {};
      const amountHuf = parseAmountHuf(session.amount_total, metadata.amount_huf);
      const amountEur = parseAmountEur(session.amount_total, metadata.amount_eur);
      const orderType = metadata.order_type ?? "";
      const deviceIdentifier = metadata.device_identifier || null;
      const userEmail = metadata.user_email ?? null;
      const customerEmail = session.customer_details?.email ?? null;
      const emailForAuthResolution = userEmail || customerEmail;
      const isDevicePurchase = orderType === "device_purchase";
      const isTopup = orderType === "topup";

      const travelDestination = (metadata.travel_destination ?? "").trim() || null;

      const { error } = await supabase.from("stripe_topups").upsert(
        {
          stripe_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          user_id: metadata.user_id ?? null,
          user_email: userEmail,
          device_identifier: deviceIdentifier,
          amount_huf: amountHuf,
          currency: session.currency?.toUpperCase() ?? "HUF",
          status: "paid",
          paid_at: new Date().toISOString(),
          payload: session,
          travel_destination: travelDestination,
        },
        {
          onConflict: "stripe_session_id",
          ignoreDuplicates: false,
        },
      );

      if (error) {
        return new Response(`Supabase error: ${error.message}`, { status: 500 });
      }

      if (isDevicePurchase) {
        const deviceId = metadata.device_id ?? null;
        const authUserId = await resolveAuthUserIdByEmail(
          supabase,
          emailForAuthResolution,
          metadata.user_id ?? null,
        );
        const category = metadata.category ?? null;
        const reservationId = (metadata.reservation_id ?? "").trim();

        if (!deviceId || !authUserId || !category || !deviceIdentifier) {
          return new Response("Device purchase metadata incomplete", { status: 500 });
        }

        const paidAt = new Date().toISOString();

        const licensePlate = (metadata.license_plate ?? "").trim() || null;

        let updatedRows: Array<{ id: string }> | null = null;
        let deviceUpdateError: { message: string } | null = null;
        if (reservationId) {
          const { data: reservationRow, error: reservationErr } = await supabase
            .from("device_payment_reservations")
            .select("id, expires_at, paid_at, cancelled_at")
            .eq("id", reservationId)
            .maybeSingle();
          if (reservationErr) {
            return new Response(`Reservation lookup error: ${reservationErr.message}`, { status: 500 });
          }
          if (!reservationRow) {
            return new Response("Reservation not found", { status: 500 });
          }
          const expired =
            reservationRow.cancelled_at !== null ||
            reservationRow.paid_at !== null ||
            new Date(reservationRow.expires_at).getTime() < Date.now();
          if (expired) {
            return new Response("Reservation expired or already processed", { status: 409 });
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
              return new Response(`Device re-check error: ${currentDeviceErr.message}`, { status: 500 });
            }
            const alreadyAssignedToUser =
              currentDevice?.status === "sold" &&
              currentDevice?.auth_user_id === authUserId;
            if (alreadyAssignedToUser) {
              updatedRows = [{ id: String(currentDevice.id) }];
            } else {
              return new Response("Reservation payment succeeded, but device assignment failed", {
                status: 409,
              });
            }
          }
          if (!deviceUpdateError) {
            const { error: reservationPaidErr } = await supabase
              .from("device_payment_reservations")
              .update({ paid_at: paidAt })
              .eq("id", reservationId)
              .is("cancelled_at", null);
            if (reservationPaidErr) {
              return new Response(`Reservation mark paid error: ${reservationPaidErr.message}`, {
                status: 500,
              });
            }
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
          return new Response(`Device update error: ${deviceUpdateError.message}`, {
            status: 500,
          });
        }

        const assignmentOk = Array.isArray(updatedRows) && updatedRows.length > 0;

        const { error: orderError } = await supabase.from("enc_device_orders").upsert(
          {
            stripe_session_id: session.id,
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

        if (orderError) {
          return new Response(`enc_device_orders error: ${orderError.message}`, {
            status: 500,
          });
        }

        const referralInviteId = (metadata.referral_invite_id ?? "").trim();
        if (referralInviteId) {
          const { error: referralUseError } = await supabase
            .from("referral_invites")
            .update({
              status: "discounted",
              discount_used_at: paidAt,
            })
            .eq("id", referralInviteId)
            .eq("invited_auth_user_id", authUserId)
            .is("discount_used_at", null);
          if (referralUseError) {
            console.error("[referral] Discount mark failed:", referralUseError.message);
          }
        }

        if (deviceIdentifier) {
          const inv = await createEracuniInvoiceStub({
            kind: "device_sale",
            deviceIdentifier,
            amountHuf,
            userEmail: userEmail,
          });
          if (!inv.ok) {
            console.error("[eracuni] Device sale invoice failed:", inv.error);
          } else if (inv.skipped) {
            console.warn("[eracuni] Device sale invoice skipped (missing config).");
          } else {
            console.info("[eracuni] Device sale invoice request sent successfully.");
          }
        }

        if (userEmail) {
          await sendAppEmail({
            to: userEmail,
            subject: "AdriaGo — sikeres ENC rendelés",
            text: `Köszönjük a vásárlást. Eszköz: ${deviceIdentifier ?? "-"}. Összeg: ${amountHuf} Ft.`,
            html: buildEmailHtml({
              title: "Sikeres rendelés",
              intro: "Köszönjük a vásárlást, a rendelésedet sikeresen rögzítettük.",
              rows: [
                { label: "Eszköz", value: deviceIdentifier ?? "-" },
                { label: "Összeg", value: `${amountHuf} Ft` },
                { label: "Rendelés azonosító", value: session.id },
              ],
            }),
          }).catch((err) => {
            console.error("[email] User order e-mail küldés sikertelen:", err);
          });
        }

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
                { label: "Összeg", value: `${amountHuf} Ft` },
                { label: "Stripe session", value: session.id },
              ],
            }),
          }).catch((err) => {
            console.error("[email] Admin order e-mail küldés sikertelen:", err);
          });
        }
      } else if (isTopup) {
        // Egyenlegfeltoltes: idempotens wallet jovairas.
        if (deviceIdentifier) {
          const { error: walletApplyError } = await supabase.rpc("apply_topup", {
            p_device_identifier: deviceIdentifier,
            p_amount_huf: amountHuf,
            p_stripe_session_id: session.id,
            p_user_email: userEmail,
          });

          if (walletApplyError) {
            return new Response(`Wallet apply error: ${walletApplyError.message}`, {
              status: 500,
            });
          }

          const inv = await createEracuniInvoiceStub({
            kind: "topup",
            deviceIdentifier,
            amountHuf,
            userEmail: userEmail,
          });
          if (!inv.ok) {
            console.error("[eracuni] Topup invoice failed:", inv.error);
          } else if (inv.skipped) {
            console.warn("[eracuni] Topup invoice skipped (missing config).");
          } else {
            console.info("[eracuni] Topup invoice request sent successfully.");
          }

          const settings = await getSettingsMap();
          const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));
          const creditedEur = Number((amountHuf / fxEurToHuf).toFixed(2));

          if (userEmail) {
            await sendAppEmail({
              to: userEmail,
              subject: "AdriaGo — sikeres egyenlegfeltöltés",
              text: `Feltöltött összeg: ${creditedEur.toLocaleString("hu-HU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} EUR, fizetett összeg: ${amountEur.toLocaleString("hu-HU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} EUR, eszköz: ${deviceIdentifier}.`,
              html: buildEmailHtml({
                title: "Sikeres egyenlegfeltöltés",
                intro: "A feltöltésed sikeresen jóváírásra került.",
                rows: [
                  { label: "Eszköz", value: deviceIdentifier ?? "-" },
                  {
                    label: "Feltöltött összeg",
                    value: `${creditedEur.toLocaleString("hu-HU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} EUR`,
                  },
                  {
                    label: "Fizetett összeg",
                    value: `${amountEur.toLocaleString("hu-HU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} EUR`,
                  },
                  { label: "Stripe session", value: session.id },
                ],
              }),
            }).catch((err) => {
              console.error("[email] User topup e-mail küldés sikertelen:", err);
            });
          }

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
              console.error("[email] Low balance e-mail küldés sikertelen:", err);
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
              console.error("[email] Negative balance user e-mail küldés sikertelen:", err);
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
                console.error("[email] Negative balance admin e-mail küldés sikertelen:", err);
              });
            }
          }
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return new Response(message, { status: 400 });
  }
}
