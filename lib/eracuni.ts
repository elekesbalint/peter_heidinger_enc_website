/**
 * e-racuni.com számlázó integráció.
 * Elsődlegesen a WebServices/API módot használja (username + secretKey + token + method),
 * fallbackként támogat egyszerű bearer /invoices hívást is.
 */
export async function createEracuniInvoice(params: {
  kind: "device_sale" | "topup";
  deviceIdentifier: string;
  amountHuf: number;
  userEmail: string | null;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
  invoicePublicUrl?: string | null;
  invoicePdfUrl?: string | null;
}> {
  // Prefer explicit TEST config when present, so live keys are not used by accident.
  const testUrl = process.env.E_RACUNI_TEST_API_URL?.trim();
  const liveUrl = process.env.E_RACUNI_API_URL?.trim();
  const baseUrl = testUrl || liveUrl;
  if (!baseUrl) {
    return { ok: true, skipped: true };
  }

  const testUsername = process.env.E_RACUNI_TEST_USERNAME?.trim();
  const liveUsername = process.env.E_RACUNI_USERNAME?.trim();
  const username = testUsername || liveUsername;

  const testSecret = process.env.E_RACUNI_TEST_API_PASSWORD?.trim();
  const liveSecret = process.env.E_RACUNI_API_PASSWORD?.trim();
  const secretKey = testSecret || liveSecret;

  const testToken = process.env.E_RACUNI_TEST_API_TOKEN?.trim();
  const liveToken = process.env.E_RACUNI_API_TOKEN?.trim();
  const token = testToken || liveToken;

  const testMethodDeviceSale = process.env.E_RACUNI_TEST_METHOD_DEVICE_SALE?.trim();
  const liveMethodDeviceSale = process.env.E_RACUNI_METHOD_DEVICE_SALE?.trim();
  const methodDeviceSale = testMethodDeviceSale || liveMethodDeviceSale;

  const testMethodTopup = process.env.E_RACUNI_TEST_METHOD_TOPUP?.trim();
  const liveMethodTopup = process.env.E_RACUNI_METHOD_TOPUP?.trim();
  const methodTopup = testMethodTopup || liveMethodTopup;

  const method = params.kind === "device_sale" ? methodDeviceSale : methodTopup;

  const itemName =
    params.kind === "device_sale" ? "ENC készülék / ENC uređaj" : "ENC készülék feltöltése";
  const note = `Azonosító / Identifikacijski broj: ${params.deviceIdentifier}`;

  function compact(text: string, max = 500): string {
    return text.replace(/\s+/g, " ").trim().slice(0, max);
  }

  function responseIndicatesFailure(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;
    const okLike = obj.ok ?? obj.success ?? obj.status;
    if (okLike === false || okLike === "error" || okLike === "failed") {
      const msg =
        (typeof obj.message === "string" && obj.message) ||
        (typeof obj.error === "string" && obj.error) ||
        (typeof obj.result === "string" && obj.result) ||
        "e-racuni válasz hibát jelzett.";
      return msg;
    }
    if (obj.error && typeof obj.error === "object") {
      const nested = obj.error as Record<string, unknown>;
      const msg =
        (typeof nested.message === "string" && nested.message) ||
        (typeof nested.error === "string" && nested.error) ||
        "e-racuni hiba objektum érkezett.";
      return msg;
    }
    return null;
  }

  function findFirstUrlByHint(payload: unknown, hints: string[]): string | null {
    const loweredHints = hints.map((h) => h.toLowerCase());
    const queue: unknown[] = [payload];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== "object") continue;
      const obj = current as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          typeof value === "string" &&
          /^https?:\/\//i.test(value) &&
          loweredHints.some((hint) => lowerKey.includes(hint))
        ) {
          return value;
        }
        if (value && typeof value === "object") queue.push(value);
      }
    }
    return null;
  }

  try {
    // e-racuni WebServices/API mode (username + secretKey + token + method)
    if (username && secretKey && token && method) {
      const endpoint = baseUrl.endsWith("/WebServices/API")
        ? baseUrl
        : `${baseUrl.replace(/\/$/, "")}/WebServices/API`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          secretKey,
          token,
          method,
          parameters: {
            customerEmail: params.userEmail,
            deviceIdentifier: params.deviceIdentifier,
            itemName,
            note,
            amountHuf: params.amountHuf,
            quantity: 1,
            // Ask e-racuni to send issued invoice by e-mail and expose public URL when supported.
            sendIssuedInvoiceByEmail: true,
            generatePublicURL: true,
          },
        }),
      });
      const raw = await res.text();
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${compact(raw)}` };
      }
      try {
        const parsed = JSON.parse(raw);
        const failed = responseIndicatesFailure(parsed);
        if (failed) return { ok: false, error: failed };
        const publicUrl = findFirstUrlByHint(parsed, ["publicurl", "public_url", "documenturl"]);
        const pdfUrl = findFirstUrlByHint(parsed, ["pdf", "pdfurl", "pdf_url"]);
        return { ok: true, invoicePublicUrl: publicUrl, invoicePdfUrl: pdfUrl };
      } catch {
        // Some e-racuni methods may return non-JSON/plain text on success.
        return { ok: true };
      }
    }

    // Legacy bearer mode
    const testKey =
      process.env.E_RACUNI_TEST_API_KEY?.trim() ||
      process.env.E_RACUNI_TEST_API_TOKEN?.trim();
    const liveKey =
      process.env.E_RACUNI_API_KEY?.trim() ||
      process.env.E_RACUNI_API_TOKEN?.trim();
    const key = testKey || liveKey;
    if (!key) {
      return { ok: true, skipped: true };
    }

    const res = await fetch(baseUrl.replace(/\/$/, "") + "/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        customer_email: params.userEmail,
        items: [{ name: itemName, note, quantity: 1, unit_price_huf: params.amountHuf }],
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${compact(raw)}` };
    }
    try {
      const parsed = JSON.parse(raw);
      const failed = responseIndicatesFailure(parsed);
      if (failed) return { ok: false, error: failed };
      const publicUrl = findFirstUrlByHint(parsed, ["publicurl", "public_url", "documenturl"]);
      const pdfUrl = findFirstUrlByHint(parsed, ["pdf", "pdfurl", "pdf_url"]);
      return { ok: true, invoicePublicUrl: publicUrl, invoicePdfUrl: pdfUrl };
    } catch {
      // tolerate non-JSON success payload
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "e-racuni hiba" };
  }
}
