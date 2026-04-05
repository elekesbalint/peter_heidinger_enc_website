import { requireAdmin } from "@/lib/admin-guard";
import { getSettingsMap } from "@/lib/app-settings";
import { buildEmailHtml, type EmailHtmlRow } from "@/lib/email-html";
import { sendAppEmail } from "@/lib/notify-email";
import { buildPostaTrackingPageUrl } from "@/lib/posta-tracking-url";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  createMplSandboxShipmentAndLabel,
  createMplSandboxShipmentLabelOnly,
} from "@/lib/mpl-sandbox";

type Action = "archive" | "restore" | "cancel" | "uncancel" | "ship" | "update_shipping";

type AddressFields = {
  country: string;
  zip: string;
  city: string;
  street: string;
  extra: string;
};

function parseAddress(raw: string | null | undefined): AddressFields {
  const empty: AddressFields = {
    country: "Magyarország",
    zip: "",
    city: "",
    street: "",
    extra: "",
  };
  const compact = raw?.replace(/\n/g, ", ").replace(/\s+/g, " ").trim() ?? "";
  if (!compact) return empty;

  const parts = compact
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 4) {
    const [country, zipCity, street, ...rest] = parts;
    const zipCityMatch = zipCity.match(/^(\d{4})\s+(.+)$/);
    return {
      ...empty,
      country: country || empty.country,
      zip: zipCityMatch ? zipCityMatch[1] ?? "" : "",
      city: zipCityMatch ? zipCityMatch[2] ?? "" : zipCity,
      street: street || "",
      extra: rest.join(", "),
    };
  }

  const zipCityMatch = compact.match(/(\d{4})\s+([^,]+)/);
  if (zipCityMatch) {
    return {
      ...empty,
      zip: zipCityMatch[1] ?? "",
      city: (zipCityMatch[2] ?? "").trim(),
      street: compact,
    };
  }

  const countryMatch = compact.match(/^(Magyarország|Hungary)[,\s]+/i);
  if (countryMatch) {
    return { ...empty, country: countryMatch[1] ?? empty.country, street: compact };
  }

  return { ...empty, street: compact };
}

function sanitizePhone(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  // Keep digits; ensure leading '+' for E.164.
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return `+${digits}`;
}

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    id?: string;
    action?: Action;
    tracking_number?: string;
    mpl_payload?: unknown | null;
    mpl_sender_agreement?: string | null;
    shipping_address?: string | null;
  };

  const id = (body.id ?? "").trim();
  const action = body.action;
  if (!id || !action) {
    return Response.json({ ok: false, error: "Hianyzo id vagy action." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  let patch: Record<string, unknown> = {};
  let mplForDb: unknown = null;

  switch (action) {
    case "archive":
      patch = { archived_at: now };
      break;
    case "restore":
      patch = { archived_at: null };
      break;
    case "cancel":
      patch = { cancelled_at: now };
      break;
    case "uncancel":
      patch = { cancelled_at: null };
      break;
    case "ship":
      try {
        const trackingInput = (body.tracking_number ?? "").trim();
        const mplPayload = body.mpl_payload;
        const hasMplPayload =
          mplPayload != null &&
          (Array.isArray(mplPayload)
            ? mplPayload.length > 0
            : typeof mplPayload === "object"
              ? Object.keys(mplPayload as Record<string, unknown>).length > 0
              : true);

        // 1) Ha van MPL payload: shipment create + label lekérdezés.
        if (hasMplPayload) {
          const mplResult = await createMplSandboxShipmentAndLabel(mplPayload);
          mplForDb = {
            request: mplPayload,
            createResponse: mplResult.mplCreateResponse,
            labelResponse: mplResult.mplLabelResponse,
            labelType: mplResult.labelType,
          };

          patch = {
            shipped_at: now,
            tracking_number: mplResult.trackingNumber,
            mpl_payload: mplForDb,
          };
        } else if (trackingInput) {
          // 2) Ha nincs payload, de van tracking szám: csak label lekérdezés.
          const labelResult = await createMplSandboxShipmentLabelOnly({
            trackingNumber: trackingInput,
            labelType: process.env.MPL_LABEL_TYPE?.trim() || "A5",
          });
          mplForDb = {
            trackingNumber: labelResult.trackingNumber,
            labelType: labelResult.labelType,
            labelResponse: labelResult.mplLabelResponse,
          };

          patch = {
            shipped_at: now,
            tracking_number: labelResult.trackingNumber,
            mpl_payload: mplForDb,
          };
        } else {
          // 3) Sandbox demo mód:
          // Ha nincs mpl_payload és nincs tracking_number, generálunk egy minimális "dolgozó" sandbox kérést,
          // így a laikus admin is tud tesztelni JSON-írás nélkül.
          // MPL doksi szerint az orderId max 50 karakter, ezért rövidítjük.
          const demoOrderId = `enc-${id.replace(/-/g, "").slice(0, 12)}`;
          const senderAgreement =
            (body.mpl_sender_agreement ?? process.env.MPL_SENDER_AGREEMENT?.trim() ?? "").trim();
          if (!senderAgreement) {
            return Response.json(
              {
                ok: false,
                error:
                  "MPL sender.agreement (megállapodás kód) kötelező a sandbox címkegeneráláshoz. Add meg az admin felületen a „MPL megállapodás kód” mezőben.",
              },
              { status: 400 },
            );
          }

          // Felhasználó (címzett) adatok: profiles táblából, amit a felhasználó a „Profil csímek” részen tölt ki.
          const { data: orderRow, error: orderErr } = await supabase
            .from("enc_device_orders")
            .select("auth_user_id, user_email")
            .eq("id", id)
            .maybeSingle();
          if (orderErr || !orderRow) {
            return Response.json({ ok: false, error: "Rendeles nem talalhato." }, { status: 404 });
          }

          const { data: profileRow, error: profileErr } = await supabase
            .from("profiles")
            .select("name, phone, shipping_address")
            .eq("auth_user_id", orderRow.auth_user_id)
            .maybeSingle();
          if (profileErr || !profileRow) {
            return Response.json({ ok: false, error: "Felhasznalo profilja nem talalhato." }, { status: 400 });
          }

          const shippingAddr = parseAddress(profileRow.shipping_address);
          if (!/^\d{4}$/.test(shippingAddr.zip) || !shippingAddr.city || !shippingAddr.street) {
            return Response.json(
              {
                ok: false,
                error:
                  "A felhasználó szállítási címe hiányos. A felhasználónak ki kell töltenie a „Profil csímek” oldalon a szállítási címet.",
              },
              { status: 400 },
            );
          }

          const recipientContact: Record<string, unknown> = {
            ...(profileRow.name ? { name: profileRow.name } : {}),
            ...(orderRow.user_email ? { email: orderRow.user_email } : {}),
            ...(sanitizePhone(profileRow.phone) ? { phone: sanitizePhone(profileRow.phone) } : {}),
          };
          const streetWithExtra =
            shippingAddr.street && shippingAddr.extra
              ? `${shippingAddr.street}, ${shippingAddr.extra}`
              : shippingAddr.street || shippingAddr.extra;
          const settings = await getSettingsMap();
          const senderAddressCountry =
            settings.mpl_sender_country?.trim() || "Magyarország";
          const senderAddressZip =
            settings.mpl_sender_zip?.trim() || "1138";
          const senderAddressCity =
            settings.mpl_sender_city?.trim() || "Budapest";
          const senderAddressStreet =
            settings.mpl_sender_street?.trim() || "Fő utca 1.";
          const senderAddressLine = senderAddressCountry
            ? `${senderAddressCountry}, ${senderAddressStreet}`
            : senderAddressStreet;
          const senderAddressRemark =
            settings.mpl_sender_remark?.trim() || "admin beállítás";
          const senderContactName =
            settings.mpl_sender_name?.trim() || "AdriaGo Feladó";
          const senderContactEmail =
            settings.mpl_sender_email?.trim() || "teszt@pelda.hu";
          const senderContactPhone =
            settings.mpl_sender_phone?.trim() || "+36201234567";

          const demoPayload = [
            {
              labelType: "A5",
              developer: "AdriaGo",
              webshopId: "1",
              orderId: demoOrderId,
              shipmentDate: new Date().toISOString(),
              tag: "demo",
              sender: {
                agreement: senderAgreement,
                contact: {
                  name: senderContactName,
                  email: senderContactEmail,
                  // MPL sandbox validációhoz: mobil prefixel (pl. +36 20 ...)
                  phone: senderContactPhone,
                },
                address: {
                  postCode: senderAddressZip,
                  city: senderAddressCity,
                  address: senderAddressLine,
                  remark: senderAddressRemark,
                },
              },
              item: [
                {
                  customData1: `enc:${id}`,
                  customData2: "sandbox-demo",
                  weight: { value: 1000, unit: "G" },
                  size: "S",
                  services: {
                    basic: "A_175_UZL",
                    cod: 0,
                    // MPL sandbox validáció szerint az értéknyilvánításra használt összegnek limitje van.
                    // A korábbi hibánál 2000000 körül nem volt elfogadott, ezért picit a limit alatt adunk meg értéket.
                    value: 1999999,
                    extra: ["K_ENY"],
                    deliveryMode: "HA",
                  },
                },
              ],
              recipient: {
                contact: recipientContact,
                address: {
                  postCode: shippingAddr.zip,
                  city: shippingAddr.city,
                  address: streetWithExtra,
                  remark: "auto",
                },
                disabled: false,
              },
              paymentMode: "UV_AT",
              packageRetention: 10,
            },
          ];

          const mplResult = await createMplSandboxShipmentAndLabel(demoPayload);
          mplForDb = {
            request: demoPayload,
            createResponse: mplResult.mplCreateResponse,
            labelResponse: mplResult.mplLabelResponse,
            labelType: mplResult.labelType,
          };

          patch = {
            shipped_at: now,
            tracking_number: mplResult.trackingNumber,
            mpl_payload: mplForDb,
          };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "MPL hiba";
        return Response.json({ ok: false, error: msg }, { status: 500 });
      }
      break;
    case "update_shipping": {
      const shippingAddress = (body.shipping_address ?? "").trim();
      if (!shippingAddress) {
        return Response.json({ ok: false, error: "A szállítási cím nem lehet üres." }, { status: 400 });
      }
      const { data: orderRow, error: orderErr } = await supabase
        .from("enc_device_orders")
        .select("auth_user_id")
        .eq("id", id)
        .maybeSingle();
      if (orderErr || !orderRow?.auth_user_id) {
        return Response.json({ ok: false, error: "Rendelés nem található." }, { status: 404 });
      }
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ shipping_address: shippingAddress, updated_at: now })
        .eq("auth_user_id", orderRow.auth_user_id);
      if (profileErr) {
        return Response.json({ ok: false, error: profileErr.message }, { status: 500 });
      }
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ ok: false, error: "Ismeretlen action." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("enc_device_orders")
    .update(patch)
    .eq("id", id)
    .select("id, user_email, tracking_number, device_identifier, category")
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "Rendeles nem talalhato." }, { status: 404 });
  }

  if (action === "ship") {
    const email = typeof data.user_email === "string" ? data.user_email.trim() : "";
    const tracking = typeof data.tracking_number === "string" ? data.tracking_number.trim() : "";
    const deviceIdf =
      typeof data.device_identifier === "string" && data.device_identifier.trim()
        ? data.device_identifier.trim()
        : "—";
    const categoryLabel =
      typeof data.category === "string" && data.category.trim()
        ? data.category.trim().toUpperCase()
        : "—";

    if (email) {
      const trackingUrl = tracking ? buildPostaTrackingPageUrl(tracking) : "";
      const intro = tracking
        ? "A megrendelt ENC csomagod feladásra került. A szállítást a Magyar Posta (MPL) végzi. A követési számra kattintva a Posta nyomkövető oldalán ellenőrizheted a küldemény állapotát."
        : "A megrendelt ENC csomagod feladásra került. A szállítást a Magyar Posta (MPL) végzi. Ha a követési szám még nem szerepel az adatbázisban, a küldeményt a Posta rendszerében a címzett adatai alapján is nyomon követheted, vagy hamarosan külön értesítést kapsz.";

      const rows: EmailHtmlRow[] = [
        { label: "Szállító", value: "Magyar Posta (MPL)" },
        { label: "Eszköz azonosító", value: deviceIdf },
        { label: "Kategória", value: categoryLabel },
      ];
      if (tracking) {
        if (trackingUrl.startsWith("https://")) {
          rows.push({
            label: "Csomagkövetési szám",
            linkHref: trackingUrl,
            linkText: tracking,
          });
        } else {
          rows.push({ label: "Csomagkövetési szám", value: tracking });
        }
      }

      const textLines = [
        "A megrendelt ENC csomagod feladásra került.",
        "Szállító: Magyar Posta (MPL)",
        `Eszköz: ${deviceIdf}`,
        `Kategória: ${categoryLabel}`,
      ];
      if (tracking) {
        textLines.push(`Csomagkövetési szám: ${tracking}`);
        textLines.push(`Nyomkövetés (posta.hu): ${trackingUrl}`);
      }

      await sendAppEmail({
        to: email,
        subject: "AdriaGo — csomagod feladásra került (MPL)",
        text: textLines.join("\n"),
        html: buildEmailHtml({
          title: "Csomagfeladás — MPL",
          intro,
          rows,
        }),
      }).catch((err) => {
        console.error("[email] Csomagfeladás e-mail küldés sikertelen:", err);
      });
    }
  }

  return Response.json({
    ok: true,
    ...(typeof patch === "object" && patch && "tracking_number" in patch ? { trackingNumber: patch.tracking_number } : {}),
  });
}
