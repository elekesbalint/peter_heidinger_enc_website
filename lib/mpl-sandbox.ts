import { randomUUID } from "crypto";

type MplCreateShipmentResponse = Array<{
  webshopId?: string;
  trackingNumber?: string | null;
  suggestedRecipientPostCode?: string | null;
  suggestedRecipientCity?: string | null;
  suggestedRecipientAddress?: string | null;
  label?: string | null;
  errors?: unknown;
  warnings?: unknown;
}>;

type MplLabelQueryResponse = Array<{
  trackingNumber?: string;
  label?: string | null;
  errors?: unknown;
  code?: string;
  parameter?: string;
  text?: string;
  warnings?: unknown;
}>;

const MPL_SANDBOX_BASE_URL_DEFAULT = "https://sandbox.api.posta.hu/v2/mplapi";
// A sandbox client_id/client_secret-hez tipikusan a sandbox környezet OAuth token endpointja tartozik.
const MPL_TOKEN_URL_DEFAULT = "https://sandbox.api.posta.hu/oauth2/token";

async function getMplSandboxAccessToken() {
  const apiKey = process.env.MPL_SANDBOX_API_KEY?.trim();
  const apiSecret = process.env.MPL_SANDBOX_API_SECRET?.trim();
  const tokenUrl = process.env.MPL_OAUTH_TOKEN_URL?.trim() || MPL_TOKEN_URL_DEFAULT;

  if (!apiKey || !apiSecret) {
    throw new Error("MPL_SANDBOX_API_KEY / MPL_SANDBOX_API_SECRET missing");
  }

  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  const rawText = await res.text().catch(() => "");
  const json = (rawText ? safeJsonParse(rawText) : ({})) as {
    access_token?: string;
    error?: unknown;
  };
  if (!res.ok || !json.access_token) {
    const msg =
      (typeof json.error === "string" && json.error) ? json.error : rawText ? rawText : `HTTP ${res.status}`;
    throw new Error(`MPL token request failed: ${msg}`);
  }

  return json.access_token;
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function normalizeShipmentsPayload(mplPayload: unknown): unknown[] {
  if (Array.isArray(mplPayload)) return mplPayload;
  if (mplPayload && typeof mplPayload === "object") return [mplPayload];
  throw new Error("Invalid MPL payload: expected shipment object or array");
}

function sanitizeParcelPickupSite(shipments: unknown[]): unknown[] {
  // MPL: ha a deliveryMode nem CS/PP, akkor a parcelPickupSite mező nem lehet megadva / nem passzolhat.
  return shipments.map((s) => {
    if (!s || typeof s !== "object") return s;
    const sh = s as Record<string, unknown>;
    const item = sh.item;
    const items = Array.isArray(item) ? item : [];
    const modes = items
      .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>).services : null))
      .filter(Boolean)
      .map((svc) => (svc && typeof svc === "object" ? (svc as Record<string, unknown>).deliveryMode : null))
      .filter((m): m is string => typeof m === "string");

    const hasPickupMode = modes.some((m) => m === "CS" || m === "PP");
    if (hasPickupMode) return s;

    const recipient = sh.recipient;
    if (!recipient || typeof recipient !== "object") return s;
    const addr = (recipient as Record<string, unknown>).address;
    if (!addr || typeof addr !== "object") return s;
    if ("parcelPickupSite" in (addr as Record<string, unknown>)) {
      delete (addr as Record<string, unknown>).parcelPickupSite;
    }
    return sh;
  });
}

function extractLabelType(mplPayload: unknown, fallback = "A5"): string {
  const shipments = normalizeShipmentsPayload(mplPayload);
  const first = shipments[0];
  if (first && typeof first === "object" && "labelType" in first) {
    const maybe = (first as Record<string, unknown>).labelType;
    if (typeof maybe === "string" && maybe.trim()) return maybe.trim();
  }
  return fallback;
}

export async function createMplSandboxShipmentAndLabel(mplPayload: unknown) {
  const baseUrl = process.env.MPL_SANDBOX_BASE_URL?.trim() || MPL_SANDBOX_BASE_URL_DEFAULT;
  const xAccountingCode = process.env.MPL_X_ACCOUNTING_CODE?.trim();

  const shipments = sanitizeParcelPickupSite(normalizeShipmentsPayload(mplPayload));
  const labelType = extractLabelType(mplPayload, "A5");

  const accessToken = await getMplSandboxAccessToken();
  const requestId = randomUUID();
  const correlationId = requestId;

  const createRes = await fetch(`${baseUrl}/shipments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(xAccountingCode ? { "X-Accounting-Code": xAccountingCode } : {}),
      "X-Request-ID": requestId,
      "X-Correlation-ID": correlationId,
    },
    body: JSON.stringify(shipments),
  });

  const createText = await createRes.text().catch(() => "");
  const createJson = (createText ? safeJsonParse(createText) : null) as MplCreateShipmentResponse | null;
  if (!createRes.ok || !Array.isArray(createJson) || createJson.length === 0) {
    const extra = typeof createText === "string" && createText ? `: ${createText.slice(0, 1000)}` : "";
    throw new Error(`MPL shipment create failed (HTTP ${createRes.status})${extra}`);
  }

  const trackingNumber = createJson[0]?.trackingNumber ?? null;
  if (!trackingNumber) {
    // Some cases can return label in create response, but tracking is the primary key for label lookup.
    const first = createJson[0] as Record<string, unknown> | undefined;
    const errors = first?.errors;
    const warnings = first?.warnings;
    const labelPresent = first && "label" in first ? (first.label != null ? true : false) : false;

    const errText =
      errors == null
        ? "no errors field"
        : typeof errors === "string"
          ? errors
          : JSON.stringify(errors);

    const warnText =
      warnings == null
        ? "no warnings field"
        : typeof warnings === "string"
          ? warnings
          : JSON.stringify(warnings);

    throw new Error(
      `MPL did not return trackingNumber (labelPresent=${labelPresent}). errors=${String(errText).slice(0, 600)} warnings=${String(
        warnText,
      ).slice(0, 600)}`,
    );
  }

  const labelQuery = new URL(`${baseUrl}/shipments/label`);
  labelQuery.searchParams.set("trackingNumbers", trackingNumber);
  labelQuery.searchParams.set("labelType", labelType);
  // If the API returns multiple labels, you can request them as a single PDF.
  // We omit singleFile unless you want to force a merged PDF.

  const labelRes = await fetch(labelQuery.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(xAccountingCode ? { "X-Accounting-Code": xAccountingCode } : {}),
      "X-Request-ID": requestId,
      "X-Correlation-ID": correlationId,
    },
  });

  const labelText = await labelRes.text().catch(() => "");
  const labelJson = (labelText ? safeJsonParse(labelText) : null) as MplLabelQueryResponse | null;
  if (!labelRes.ok || !Array.isArray(labelJson)) {
    const extra = typeof labelText === "string" && labelText ? `: ${labelText.slice(0, 1000)}` : "";
    throw new Error(`MPL label request failed (HTTP ${labelRes.status})${extra}`);
  }

  const labelBase64 = labelJson[0]?.label ?? null;
  if (!labelBase64) {
    const first = labelJson[0] as Record<string, unknown> | undefined;
    const code = first?.code ? String(first.code) : "NO_CODE";
    const text = first?.text ? String(first.text) : "NO_TEXT";
    throw new Error(`MPL label missing for trackingNumber=${trackingNumber} code=${code} text=${text}`);
  }

  return {
    trackingNumber: String(trackingNumber),
    labelBase64,
    mplCreateResponse: createJson,
    mplLabelResponse: labelJson,
    labelType,
  };
}

export async function createMplSandboxShipmentLabelOnly(params: {
  trackingNumber: string;
  labelType?: string;
}) {
  const baseUrl = process.env.MPL_SANDBOX_BASE_URL?.trim() || MPL_SANDBOX_BASE_URL_DEFAULT;
  const xAccountingCode = process.env.MPL_X_ACCOUNTING_CODE?.trim();

  const accessToken = await getMplSandboxAccessToken();
  const requestId = randomUUID();
  const correlationId = requestId;

  const labelQuery = new URL(`${baseUrl}/shipments/label`);
  labelQuery.searchParams.append("trackingNumbers", params.trackingNumber);
  labelQuery.searchParams.set("labelType", params.labelType?.trim() || "A5");

  const labelRes = await fetch(labelQuery.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(xAccountingCode ? { "X-Accounting-Code": xAccountingCode } : {}),
      "X-Request-ID": requestId,
      "X-Correlation-ID": correlationId,
    },
  });

  const labelJson = (await labelRes.json().catch(() => null)) as MplLabelQueryResponse | null;
  if (!labelRes.ok || !Array.isArray(labelJson)) {
    throw new Error(`MPL label-only request failed (HTTP ${labelRes.status})`);
  }

  const labelBase64 = labelJson[0]?.label ?? null;
  const trackingNumber = String(labelJson[0]?.trackingNumber ?? params.trackingNumber);
  if (!labelBase64) {
    const first = labelJson[0] as Record<string, unknown> | undefined;
    const code = first?.code ? String(first.code) : "NO_CODE";
    const text = first?.text ? String(first.text) : "NO_TEXT";
    const errors = first?.errors ? JSON.stringify(first.errors).slice(0, 600) : "no_errors_field";
    throw new Error(
      `MPL label missing for trackingNumber=${params.trackingNumber} code=${code} text=${text} errors=${errors}`,
    );
  }

  return {
    trackingNumber,
    labelBase64,
    mplLabelResponse: labelJson,
    labelType: params.labelType?.trim() || "A5",
  };
}

