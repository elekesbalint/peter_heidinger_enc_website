import { Buffer } from "buffer";
import { PDFDocument } from "pdf-lib";
import { requireAdmin } from "@/lib/admin-guard";
import { getSettingsMap } from "@/lib/app-settings";
import {
  createMplSandboxShipmentAndLabel,
  createMplSandboxShipmentLabelOnly,
} from "@/lib/mpl-sandbox";
import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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

  if (parts.length >= 3) {
    const zipCityPattern = /^(\d{4})\s+(.+)$/;
    const countryPattern = /^(Magyarország|Hungary)$/i;
    let country = empty.country;
    let zipCity = "";
    let streetParts: string[] = [];

    if (countryPattern.test(parts[0] ?? "")) {
      country = parts[0] ?? empty.country;
      zipCity = parts[1] ?? "";
      streetParts = parts.slice(2);
    } else if (zipCityPattern.test(parts[0] ?? "")) {
      zipCity = parts[0] ?? "";
      streetParts = parts.slice(1);
    } else {
      country = parts[0] || empty.country;
      zipCity = parts[1] ?? "";
      streetParts = parts.slice(2);
    }

    const zipCityMatch = zipCity.match(zipCityPattern);
    return {
      ...empty,
      country,
      zip: zipCityMatch ? zipCityMatch[1] ?? "" : "",
      city: zipCityMatch ? zipCityMatch[2] ?? "" : zipCity,
      street: streetParts[0] ?? "",
      extra: streetParts.slice(1).join(", "),
    };
  }

  const zipCityMatch = compact.match(/(\d{4})\s+([^,]+)/);
  if (zipCityMatch) {
    const withoutCountry = compact.replace(/^(Magyarország|Hungary)[,\s]*/i, "");
    const withoutZipCity = withoutCountry.replace(/^\d{4}\s+[^,]+,?\s*/, "").trim();
    return {
      ...empty,
      zip: zipCityMatch[1] ?? "",
      city: (zipCityMatch[2] ?? "").trim(),
      street: withoutZipCity || compact,
    };
  }

  return { ...empty, street: compact };
}

function sanitizePhone(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return `+${digits}`;
}

export async function POST(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const body = (await request.json()) as {
    ids?: string[];
    mpl_sender_agreement?: string | null;
  };
  const ids = Array.isArray(body.ids)
    ? body.ids.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (ids.length === 0) {
    return Response.json({ ok: false, error: "Nincsenek kijelölt rendelések." }, { status: 400 });
  }

  const senderAgreement =
    (body.mpl_sender_agreement ?? process.env.MPL_SENDER_AGREEMENT?.trim() ?? "").trim();
  if (!senderAgreement) {
    return Response.json(
      { ok: false, error: "MPL megállapodás kód hiányzik." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const settings = await getSettingsMap();

  const { data: orderRows, error: orderErr } = await supabase
    .from("enc_device_orders")
    .select("id, auth_user_id, user_email, tracking_number")
    .in("id", ids);
  if (orderErr) {
    return Response.json({ ok: false, error: orderErr.message }, { status: 500 });
  }

  const byId = new Map((orderRows ?? []).map((r) => [r.id, r]));
  const orders = ids
    .map((id) => byId.get(id))
    .filter((v): v is NonNullable<typeof orderRows>[number] => Boolean(v));
  if (orders.length !== ids.length) {
    return Response.json({ ok: false, error: "Van kijelölt rendelés, ami nem található." }, { status: 404 });
  }

  const authIds = Array.from(
    new Set(orders.map((o) => o.auth_user_id).filter((v): v is string => typeof v === "string" && v.trim().length > 0)),
  );
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("auth_user_id, name, phone, shipping_address")
    .in("auth_user_id", authIds);
  if (profileErr) {
    return Response.json({ ok: false, error: profileErr.message }, { status: 500 });
  }
  const profileByAuth = new Map((profiles ?? []).map((p) => [p.auth_user_id, p]));

  const senderAddressCountry = settings.mpl_sender_country?.trim() || "Magyarország";
  const senderAddressZip = settings.mpl_sender_zip?.trim() || "1138";
  const senderAddressCity = settings.mpl_sender_city?.trim() || "Budapest";
  const senderAddressStreet = settings.mpl_sender_street?.trim() || "Fő utca 1.";
  const senderAddressLine = senderAddressCountry
    ? `${senderAddressCountry}, ${senderAddressStreet}`
    : senderAddressStreet;
  const senderAddressRemark = settings.mpl_sender_remark?.trim() || "admin beállítás";
  const senderContactName = settings.mpl_sender_name?.trim() || "AdriaGo Feladó";
  const senderContactEmail = settings.mpl_sender_email?.trim() || "teszt@pelda.hu";
  const senderContactPhone = settings.mpl_sender_phone?.trim() || "+36201234567";

  type GenerationResult = {
    id: string;
    trackingNumber: string;
    labelBytes: Uint8Array;
    mplPayloadForDb: unknown;
    userEmail: string | null;
  };
  const generated: GenerationResult[] = [];

  // First phase: generate every label. If any fails, no order status will be changed.
  for (const order of orders) {
    const existingTracking = (order.tracking_number ?? "").trim();
    if (existingTracking) {
      const labelResult = await createMplSandboxShipmentLabelOnly({
        trackingNumber: existingTracking,
        labelType: process.env.MPL_LABEL_TYPE?.trim() || "A5",
      });
      generated.push({
        id: order.id,
        trackingNumber: labelResult.trackingNumber,
        labelBytes: Buffer.from(labelResult.labelBase64, "base64"),
        mplPayloadForDb: {
          trackingNumber: labelResult.trackingNumber,
          labelType: labelResult.labelType,
          labelResponse: labelResult.mplLabelResponse,
        },
        userEmail: order.user_email ?? null,
      });
      continue;
    }

    const profile = order.auth_user_id ? profileByAuth.get(order.auth_user_id) : null;
    if (!profile) {
      return Response.json(
        { ok: false, error: `Hiányzó profil: ${order.user_email ?? order.id}` },
        { status: 400 },
      );
    }

    const shippingAddr = parseAddress(profile.shipping_address);
    if (!/^\d{4}$/.test(shippingAddr.zip) || !shippingAddr.city || !shippingAddr.street) {
      return Response.json(
        {
          ok: false,
          error: `Hiányos szállítási cím: ${order.user_email ?? order.id}`,
        },
        { status: 400 },
      );
    }
    const recipientContact: Record<string, unknown> = {
      ...(profile.name ? { name: profile.name } : {}),
      ...(order.user_email ? { email: order.user_email } : {}),
      ...(sanitizePhone(profile.phone) ? { phone: sanitizePhone(profile.phone) } : {}),
    };
    const streetWithExtra =
      shippingAddr.street && shippingAddr.extra
        ? `${shippingAddr.street}, ${shippingAddr.extra}`
        : shippingAddr.street || shippingAddr.extra;

    const demoPayload = [
      {
        labelType: "A5",
        developer: "AdriaGo",
        webshopId: "1",
        orderId: `enc-${order.id.replace(/-/g, "").slice(0, 12)}`,
        shipmentDate: new Date().toISOString(),
        tag: "bulk",
        sender: {
          agreement: senderAgreement,
          contact: {
            name: senderContactName,
            email: senderContactEmail,
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
            customData1: `enc:${order.id}`,
            customData2: "bulk-shipment",
            weight: { value: 1000, unit: "G" },
            size: "S",
            services: {
              basic: "A_175_UZL",
              cod: 0,
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
    generated.push({
      id: order.id,
      trackingNumber: mplResult.trackingNumber,
      labelBytes: Buffer.from(mplResult.labelBase64, "base64"),
      mplPayloadForDb: {
        request: demoPayload,
        createResponse: mplResult.mplCreateResponse,
        labelResponse: mplResult.mplLabelResponse,
        labelType: mplResult.labelType,
      },
      userEmail: order.user_email ?? null,
    });
  }

  const merged = await PDFDocument.create();
  for (const row of generated) {
    const src = await PDFDocument.load(row.labelBytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  const mergedBytes = await merged.save();

  // Second phase: persist shipment state only after every label is successfully generated.
  const now = new Date().toISOString();
  for (const row of generated) {
    const { error } = await supabase
      .from("enc_device_orders")
      .update({
        shipped_at: now,
        tracking_number: row.trackingNumber,
        mpl_payload: row.mplPayloadForDb,
      })
      .eq("id", row.id);
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (row.userEmail && row.trackingNumber) {
      await sendAppEmail({
        to: row.userEmail,
        subject: "AdriaGo — csomagfeladás megtörtént",
        text: `A csomagod feladásra került. Csomagkövetési azonosító: ${row.trackingNumber}`,
      }).catch(() => undefined);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new Response(Buffer.from(mergedBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mpl-labels-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
