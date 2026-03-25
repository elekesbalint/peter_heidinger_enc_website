/**
 * e-racuni.com szamlazas vaz — E_RACUNI_API_KEY es E_RACUNI_API_URL beallitas utan hivhato.
 * Dokumentacio: https://e-racuni.com/ (API reszletek a kulcs mellett)
 */
export async function createEracuniInvoiceStub(params: {
  kind: "device_sale" | "topup";
  deviceIdentifier: string;
  amountHuf: number;
  userEmail: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
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
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 500)}` };
      }
      return { ok: true };
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
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 500)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "e-racuni hiba" };
  }
}
