/**
 * e-racuni.com számlázó integráció.
 * Elsődlegesen a WebServices/API módot használja (username + secretKey + token + method),
 * fallbackként támogat egyszerű bearer /invoices hívást is.
 *
 * SalesInvoiceCreate: a hivatalos WS API séma szerint is küldünk mezőket (buyerName, buyerStreet,
 * buyerEMail, Items[], dateOfSupplyFrom, type Retail, methodOfPayment) — lásd e-racuni wiki WS API SalesInvoice.
 *
 * E_RACUNI_PAYMENT_METHOD: dokumentáció szerinti stringEnum (PaymentRecord.paymentMethodForInvoice), pl.
 * BankTransfer, Cash, Stripe, CreditCard, Barion, PayPal, … — vagy magyar alias (pl. „átutalás a bankszámlára” → BankTransfer).
 *
 * Opcionális BuyerData: E_RACUNI_BUYER_CODE, E_RACUNI_BUYER_DATA_STATUS (default defaultBuyer),
 * E_RACUNI_INVOICING_LANGUAGE (default Hungarian), E_RACUNI_NUMBER_OF_DAYS_FOR_PAYMENT, E_RACUNI_DOCUMENTS_EMAIL.
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
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  const isProduction = nodeEnv === "production" || vercelEnv === "production";
  const forceLiveCredentials =
    (process.env.E_RACUNI_FORCE_LIVE_CREDENTIALS ?? "").trim().toLowerCase() === "true";
  const useLiveCredentials = isProduction || forceLiveCredentials;

  // In production only live credentials should be used.
  // In non-production environments prefer TEST, then fallback to live.
  const testUrl = process.env.E_RACUNI_TEST_API_URL?.trim();
  const liveUrl = process.env.E_RACUNI_API_URL?.trim();
  const baseUrl = useLiveCredentials ? liveUrl : testUrl || liveUrl;
  if (!baseUrl) {
    return { ok: true, skipped: true };
  }

  const testUsername = process.env.E_RACUNI_TEST_USERNAME?.trim();
  const liveUsername = process.env.E_RACUNI_USERNAME?.trim();
  const username = useLiveCredentials ? liveUsername : testUsername || liveUsername;

  const testSecret = process.env.E_RACUNI_TEST_API_PASSWORD?.trim();
  const liveSecret = process.env.E_RACUNI_API_PASSWORD?.trim();
  const secretKey = useLiveCredentials ? liveSecret : testSecret || liveSecret;

  const testToken = process.env.E_RACUNI_TEST_API_TOKEN?.trim();
  const liveToken = process.env.E_RACUNI_API_TOKEN?.trim();
  const token = useLiveCredentials ? liveToken : testToken || liveToken;

  const testMethodDeviceSale = process.env.E_RACUNI_TEST_METHOD_DEVICE_SALE?.trim();
  const liveMethodDeviceSale = process.env.E_RACUNI_METHOD_DEVICE_SALE?.trim();
  const methodDeviceSale = useLiveCredentials
    ? liveMethodDeviceSale
    : testMethodDeviceSale || liveMethodDeviceSale;

  const testMethodTopup = process.env.E_RACUNI_TEST_METHOD_TOPUP?.trim();
  const liveMethodTopup = process.env.E_RACUNI_METHOD_TOPUP?.trim();
  const methodTopup = useLiveCredentials ? liveMethodTopup : testMethodTopup || liveMethodTopup;

  const method = params.kind === "device_sale" ? methodDeviceSale : methodTopup;

  const itemName =
    params.kind === "device_sale" ? "ENC készülék / ENC uređaj" : "ENC készülék feltöltése";
  const note = `Azonosító / Identifikacijski broj: ${params.deviceIdentifier}`;
  const today = new Date().toISOString().slice(0, 10);
  const invoiceCurrency = process.env.E_RACUNI_CURRENCY?.trim() || "EUR";
  const normalizedAmountHuf = Number.isFinite(params.amountHuf)
    ? Math.round(params.amountHuf)
    : NaN;
  if (!Number.isFinite(normalizedAmountHuf) || normalizedAmountHuf <= 0) {
    return { ok: false, error: "Érvénytelen számlaösszeg: amountHuf legyen pozitív szám." };
  }

  /** API docs: PaymentRecord.paymentMethodForInvoice stringEnum (Cash, BankTransfer, Stripe, …). */
  function resolveEracuniPaymentMethod(raw: string): string {
    const t = raw.trim();
    if (!t) return t;
    const lower = t.replace(/\s+/g, " ").trim().toLowerCase();
    const aliases: Record<string, string> = {
      "átutalás a bankszámlára": "BankTransfer",
      "atutalas a bankszamlara": "BankTransfer",
      "bank transfer": "BankTransfer",
      banktransfer: "BankTransfer",
      "készpénz": "Cash",
      keszpenz: "Cash",
      cash: "Cash",
      stripe: "Stripe",
      barion: "Barion",
      "hitelkártya": "CreditCard",
      "credit card": "CreditCard",
      creditcard: "CreditCard",
      paypal: "PayPal",
      sumup: "SumUp",
      vivawallet: "VivaWallet",
      mollie: "Mollie",
      klarna: "Klarna",
      "-": "Unknown",
      unknown: "Unknown",
      other: "Other",
    };
    return aliases[lower] ?? t;
  }

  function compact(text: string, max = 500): string {
    return text.replace(/\s+/g, " ").trim().slice(0, max);
  }

  function responseIndicatesFailure(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;
    const nestedResponse =
      obj.response && typeof obj.response === "object"
        ? (obj.response as Record<string, unknown>)
        : null;
    const okLike = obj.ok ?? obj.success ?? obj.status ?? nestedResponse?.status;
    if (okLike === false || okLike === "error" || okLike === "failed") {
      const msg =
        (typeof obj.message === "string" && obj.message) ||
        (typeof obj.error === "string" && obj.error) ||
        (typeof obj.result === "string" && obj.result) ||
        (typeof obj.description === "string" && obj.description) ||
        (typeof nestedResponse?.description === "string" && nestedResponse.description) ||
        (typeof nestedResponse?.message === "string" && nestedResponse.message) ||
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

  function hasInvalidAuthMessage(payload: unknown): boolean {
    if (!payload || typeof payload !== "object") return false;
    const serialized = JSON.stringify(payload).toLowerCase();
    return (
      serialized.includes("korisničko ime") ||
      serialized.includes("zaporka") ||
      serialized.includes("username") ||
      serialized.includes("password") ||
      serialized.includes("not valid")
    );
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

  function buildEracuniEndpoints(base: string): string[] {
    const trimmed = base.replace(/\/$/, "");
    const candidates: string[] = [];
    const push = (url: string) => {
      const clean = url.replace(/\/$/, "");
      if (!candidates.includes(clean)) candidates.push(clean);
    };

    if (trimmed.endsWith("/WebServices/API")) {
      push(trimmed);
      push(trimmed.replace(/\/WebServices\/API$/, "/API"));
    } else if (trimmed.endsWith("/API")) {
      push(trimmed);
      push(trimmed.replace(/\/API$/, "/WebServices/API"));
    } else {
      push(`${trimmed}/API`);
      push(`${trimmed}/WebServices/API`);
    }

    try {
      const url = new URL(trimmed);
      const baseOrigin = `${url.protocol}//${url.host}`;
      const parts = url.pathname.split("/").filter(Boolean);
      const org = parts[0] ?? "";
      if (org) {
        // Some tenants expose API under /H7 instead of /H7i (or vice versa).
        const simplifiedOrg = org.replace(/[a-z]$/i, "");
        if (simplifiedOrg && simplifiedOrg !== org) {
          push(`${baseOrigin}/${simplifiedOrg}/API`);
          push(`${baseOrigin}/${simplifiedOrg}/WebServices/API`);
        }
      }
    } catch {
      // Ignore URL parsing errors and keep current candidates.
    }

    return candidates;
  }

  function extractHumanErrorFromHtml(html: string): string | null {
    if (!html || typeof html !== "string") return null;
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const text = withoutScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return null;
    // Keep a concise, readable message; removes CSS noise from dashboard error output.
    return text.slice(0, 400);
  }

  function buildPartnerPostalAddress(): Record<string, unknown> {
    const buyerStreet = process.env.E_RACUNI_BUYER_STREET?.trim() || "Ismeretlen cím 1";
    const buyerPostalCode = process.env.E_RACUNI_BUYER_POSTAL_CODE?.trim() || "1000";
    const buyerCity = process.env.E_RACUNI_BUYER_CITY?.trim() || "Budapest";
    const buyerCountry = process.env.E_RACUNI_BUYER_COUNTRY_CODE?.trim() || "HU";
    return {
      street: buyerStreet,
      postalCode: buyerPostalCode,
      city: buyerCity,
      country: buyerCountry,
      countryCode: buyerCountry,
    };
  }

  function buildPartnerPayload(): Record<string, unknown> {
    const buyerEmail = params.userEmail || "";
    const buyerName = params.userEmail || "AdriaGo ügyfél";
    const buyerStreet = process.env.E_RACUNI_BUYER_STREET?.trim() || "Ismeretlen cím 1";
    const buyerPostalCode = process.env.E_RACUNI_BUYER_POSTAL_CODE?.trim() || "1000";
    const buyerCity = process.env.E_RACUNI_BUYER_CITY?.trim() || "Budapest";
    const buyerCountry = process.env.E_RACUNI_BUYER_COUNTRY_CODE?.trim() || "HU";
    const buyerPhone = process.env.E_RACUNI_BUYER_PHONE?.trim() || "";
    const buyerTaxNumber = process.env.E_RACUNI_BUYER_TAX_NUMBER?.trim() || "";
    const postal = buildPartnerPostalAddress();
    return {
      name: buyerName,
      email: buyerEmail,
      street: buyerStreet,
      address: buyerStreet,
      addrStreet: buyerStreet,
      postalCode: buyerPostalCode,
      postCode: buyerPostalCode,
      zip: buyerPostalCode,
      city: buyerCity,
      place: buyerCity,
      country: buyerCountry,
      countryCode: buyerCountry,
      phone: buyerPhone,
      mobile: buyerPhone,
      taxNumber: buyerTaxNumber,
      vatId: buyerTaxNumber,
      Address: postal,
      addressObject: postal,
      postalAddress: postal,
    };
  }

  /** Partner.buyerData / BuyerData per API reference (invoicing language, email docs, status, …). */
  function buildBuyerDataPayload(): Record<string, unknown> {
    const p = buildPartnerPayload();
    const email = ((p.email as string) || params.userEmail || "").trim();
    const docsEmail = email || process.env.E_RACUNI_DOCUMENTS_EMAIL?.trim() || "";
    const buyerCode =
      process.env.E_RACUNI_BUYER_CODE?.trim() ||
      process.env.E_RACUNI_PARTNER_CODE?.trim() ||
      "";
    const daysRaw = process.env.E_RACUNI_NUMBER_OF_DAYS_FOR_PAYMENT?.trim();
    const daysParsed = daysRaw ? Number.parseInt(daysRaw, 10) : NaN;
    const numberOfDaysForPayment = Number.isFinite(daysParsed) && daysParsed >= 0 ? daysParsed : 14;

    const buyerData: Record<string, unknown> = {
      status: process.env.E_RACUNI_BUYER_DATA_STATUS?.trim() || "defaultBuyer",
      invoicingCurrency: invoiceCurrency,
      invoicingLanguage: process.env.E_RACUNI_INVOICING_LANGUAGE?.trim() || "Hungarian",
      numberOfDaysForPayment,
      discountPercentage: 0,
      numberOfDaysForPaymentBaseDate:
        process.env.E_RACUNI_PAYMENT_BASE_DATE?.trim() || "fromDocumentDate",
    };
    if (docsEmail) {
      buyerData.sendDocumentsViaEmail = true;
      buyerData.emailsForSendingDocuments = docsEmail;
    } else {
      buyerData.sendDocumentsViaEmail = false;
    }
    if (buyerCode) {
      buyerData.buyerCode = buyerCode;
    }
    const po = process.env.E_RACUNI_PURCHASE_ORDER_NUMBER?.trim();
    if (po) {
      buyerData.purchaseOrderNumber = po;
    }
    const contract = process.env.E_RACUNI_CONTRACT_NUMBER?.trim();
    if (contract) {
      buyerData.contractNumber = contract;
    }
    return buyerData;
  }

  /**
   * Official WS API shape (e-racuni wiki "WS API SalesInvoice"): flat buyer* fields, Items[], methodOfPayment, type Retail.
   * Merged on top of existing payload so GUI-style partner{} and doc-style buyerName both exist.
   */
  function applyWsApiSalesInvoiceDocumentationFields(
    inv: Record<string, unknown>,
  ): Record<string, unknown> {
    const p = buildPartnerPayload();
    const itemUnit = process.env.E_RACUNI_ITEM_UNIT?.trim() || "kom";
    const itemVatPercentage = Number.parseFloat(
      process.env.E_RACUNI_ITEM_VAT_PERCENTAGE?.trim() || "27",
    );
    const safeVatPercentage = Number.isFinite(itemVatPercentage) ? itemVatPercentage : 27;
    const itemProductCode = process.env.E_RACUNI_ITEM_PRODUCT_CODE?.trim() || "";

    const wikiItems: Record<string, unknown>[] = itemProductCode
      ? [{ productCode: itemProductCode, quantity: 1 }]
      : [
          {
            description: itemName,
            quantity: 1,
            unit: itemUnit,
            price: normalizedAmountHuf,
            vatPercentage: safeVatPercentage,
          },
        ];

    const isoCountry = String(p.country);
    const countryFullName: Record<string, string> = {
      HU: "Hungary",
      HR: "Croatia",
      SI: "Slovenia",
      RS: "Serbia",
      AT: "Austria",
      DE: "Germany",
    };
    const extra: Record<string, unknown> = {
      date: inv.date ?? today,
      dateOfSupplyFrom: inv.dateOfSupplyFrom ?? today,
      currency: inv.currency ?? invoiceCurrency,
      buyerName: p.name,
      buyerStreet: p.street,
      buyerPostalCode: p.postalCode,
      buyerCity: p.city,
      buyerEMail: p.email,
      buyerPhone: (p.phone as string) || (p.mobile as string) || "",
      buyerCountry: p.country,
      buyerCountryCode: isoCountry,
      buyerCountryName:
        process.env.E_RACUNI_BUYER_COUNTRY_NAME?.trim() ||
        countryFullName[isoCountry] ||
        isoCountry,
      type: process.env.E_RACUNI_INVOICE_TYPE?.trim() || "Retail",
      note: inv.note ?? note,
    };
    const tax = (p.taxNumber as string) || "";
    if (tax) {
      extra.buyerTaxNumber = tax;
    }
    const pmRaw = process.env.E_RACUNI_PAYMENT_METHOD?.trim();
    if (pmRaw) {
      const pm = resolveEracuniPaymentMethod(pmRaw);
      extra.methodOfPayment = pm;
      extra.paymentMethodForInvoice = pm;
    }
    const bu = process.env.E_RACUNI_BUSINESS_UNIT?.trim();
    if (bu) {
      extra.businessUnit = bu;
    }

    const out = { ...inv, ...extra };
    if (!Array.isArray(out.Items) || out.Items.length === 0) {
      out.Items = wikiItems;
    }
    return out;
  }

  /** Merge partner/buyer aliases and optional payment so strict tenants accept the document. */
  function finalizeSalesInvoice(invoice: Record<string, unknown>): Record<string, unknown> {
    const base = buildPartnerPayload();
    const partnerCode = process.env.E_RACUNI_PARTNER_CODE?.trim() || "";
    const partnerIdRaw = process.env.E_RACUNI_BUYER_PARTNER_ID?.trim() || "";
    const buyerOib = process.env.E_RACUNI_BUYER_OIB?.trim() || "";
    const paymentMethodRaw = process.env.E_RACUNI_PAYMENT_METHOD?.trim() || "";
    const paymentMethod = paymentMethodRaw ? resolveEracuniPaymentMethod(paymentMethodRaw) : "";

    const partner: Record<string, unknown> = { ...base };
    if (partnerCode) {
      partner.code = partnerCode;
      partner.partnerCode = partnerCode;
    }
    if (partnerIdRaw) {
      const id = Number.parseInt(partnerIdRaw, 10);
      if (Number.isFinite(id)) {
        partner.id = id;
        partner.partnerId = id;
      }
    }
    if (buyerOib) {
      partner.oib = buyerOib;
      partner.OIB = buyerOib;
    }

    const buyerData = buildBuyerDataPayload();
    partner.buyerData = buyerData;
    partner.BuyerData = buyerData;

    let out: Record<string, unknown> = { ...invoice, partner };
    out.buyer = { ...partner };
    out.customer = { ...partner };
    if (partnerCode) {
      out.partnerCode = partnerCode;
    }
    if (paymentMethod) {
      out.paymentMethod = paymentMethod;
      out.paymentType = paymentMethod;
      out.methodOfPayment = paymentMethod;
      out.paymentMethodForInvoice = paymentMethod;
      out.payType = paymentMethod;
    }

    out = applyWsApiSalesInvoiceDocumentationFields(out);
    out.partner = { ...partner, buyerData, BuyerData: buyerData };
    out.buyerData = buyerData;
    out.BuyerData = buyerData;
    out.buyer = { ...partner, buyerData, BuyerData: buyerData };
    out.customer = { ...partner, buyerData, BuyerData: buyerData };
    if (partnerCode) {
      out.partnerCode = partnerCode;
    }
    if (paymentMethod) {
      out.methodOfPayment = paymentMethod;
      out.paymentMethod = paymentMethod;
      out.paymentType = paymentMethod;
      out.paymentMethodForInvoice = paymentMethod;
      out.payType = paymentMethod;
    }
    return out;
  }

  function buildSalesInvoiceParameter(): Record<string, unknown> {
    // Minimal valid SalesInvoice skeleton for e-racuni SalesInvoiceCreate.
    // If the tenant requires additional fields, API will now return the next missing field explicitly.
    const itemProductCode = process.env.E_RACUNI_ITEM_PRODUCT_CODE?.trim() || "";
    const itemUnit = process.env.E_RACUNI_ITEM_UNIT?.trim() || "kom";
    const itemVatPercentage = Number.parseFloat(
      process.env.E_RACUNI_ITEM_VAT_PERCENTAGE?.trim() || "27",
    );
    const safeVatPercentage = Number.isFinite(itemVatPercentage) ? itemVatPercentage : 27;
    const grossPrice = normalizedAmountHuf;
    const netPrice = Math.round(grossPrice / (1 + safeVatPercentage / 100));
    const invoiceItem: Record<string, unknown> = {
      name: itemName,
      description: itemName,
      currency: invoiceCurrency,
      unit: itemUnit,
      quantity: 1,
      unitPrice: normalizedAmountHuf,
      price: normalizedAmountHuf,
      retailPrice: normalizedAmountHuf,
      netPrice,
      grossPrice,
      vatPercentage: safeVatPercentage,
      discountPercentage: 0,
      note,
    };
    if (itemProductCode) {
      invoiceItem.productCode = itemProductCode;
      // Some tenants prefer catalog-product lines over free-text lines.
      invoiceItem.productName = itemName;
    }
    return {
      date: today,
      currency: invoiceCurrency,
      note,
      // Some tenants accept direct single-line shape instead of explicit item arrays.
      description: itemName,
      quantity: 1,
      price: normalizedAmountHuf,
      unitPrice: normalizedAmountHuf,
      partner: buildPartnerPayload(),
      items: [invoiceItem],
      // Compatibility aliases for tenants that expect different item list keys.
      item: [invoiceItem],
      invoiceItems: [invoiceItem],
      documentLines: [invoiceItem],
      documentItems: [invoiceItem],
      lines: [invoiceItem],
      line: [invoiceItem],
      documentLine: invoiceItem,
      documentItem: invoiceItem,
    };
  }

  function buildSalesInvoiceParameterMinimal(
    lineShape: "itemArray" | "itemsArray" | "itemObject" = "itemArray",
  ): Record<string, unknown> {
    const itemUnit = process.env.E_RACUNI_ITEM_UNIT?.trim() || "kom";
    const itemProductCode = process.env.E_RACUNI_ITEM_PRODUCT_CODE?.trim() || "";
    const itemVatPercentage = Number.parseFloat(
      process.env.E_RACUNI_ITEM_VAT_PERCENTAGE?.trim() || "27",
    );
    const safeVatPercentage = Number.isFinite(itemVatPercentage) ? itemVatPercentage : 27;
    const invoiceLine: Record<string, unknown> = {
      description: itemName,
      currency: invoiceCurrency,
      quantity: 1,
      price: normalizedAmountHuf,
      discountPercentage: 0,
    };
    if (itemProductCode) {
      invoiceLine.productCode = itemProductCode;
      invoiceLine.productName = itemName;
    }
    const lineContainer: Record<string, unknown> =
      lineShape === "itemObject"
        ? { item: invoiceLine }
        : lineShape === "itemsArray"
          ? { items: [invoiceLine] }
          : { item: [invoiceLine] };
    return {
      date: today,
      currency: invoiceCurrency,
      partner: buildPartnerPayload(),
      // Keep line shape selectable; tenants differ between item/items/object expectations.
      ...lineContainer,
    };
  }

  function buildSalesInvoiceParameterProductCodeOnly(
    lineShape: "itemArray" | "itemsArray" | "itemObject" = "itemArray",
  ): Record<string, unknown> | null {
    const itemProductCode = process.env.E_RACUNI_ITEM_PRODUCT_CODE?.trim() || "";
    if (!itemProductCode) return null;
    const invoiceLine: Record<string, unknown> = {
      productCode: itemProductCode,
      quantity: 1,
    };
    const lineContainer: Record<string, unknown> =
      lineShape === "itemObject"
        ? { item: invoiceLine }
        : lineShape === "itemsArray"
          ? { items: [invoiceLine] }
          : { item: [invoiceLine] };
    return {
      date: today,
      currency: invoiceCurrency,
      partner: buildPartnerPayload(),
      ...lineContainer,
    };
  }

  try {
    // e-racuni WebServices/API mode (username + secretKey + token + method)
    if (username && secretKey && token && method) {
      const endpoints = buildEracuniEndpoints(baseUrl);
      const endpointErrors: string[] = [];
      for (const endpoint of endpoints) {
        const attemptErrors: string[] = [];
        // If productCode is configured, prefer strict productCode-only line first.
        const salesInvoice = finalizeSalesInvoice(
          buildSalesInvoiceParameterProductCodeOnly("itemArray") ||
            buildSalesInvoiceParameterMinimal("itemArray"),
        );
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            // e-racuni docs use "secretkey" (lowercase); keep camelCase too for compatibility.
            secretkey: secretKey,
            secretKey,
            token,
            method,
            parameters: {
              SalesInvoice: salesInvoice,
              Salesinvoice: salesInvoice,
              // Ask e-racuni to send issued invoice by e-mail and expose public URL when supported.
              sendIssuedInvoiceByEmail: true,
              generatePublicURL: true,
            },
          }),
        });
        const raw = await res.text();
        if (!res.ok) {
          let readable: string | null =
            raw.includes("<html") || raw.includes("<!DOCTYPE")
              ? extractHumanErrorFromHtml(raw)
              : compact(raw);
          // Prefer API-provided structured message (e.g. response.description) over raw JSON string.
          try {
            const parsedErr = JSON.parse(raw);
            readable = responseIndicatesFailure(parsedErr) || readable;
            // Fallback retry: some tenants only parse richer alias-heavy item structures.
            if ((readable || "").toLowerCase().includes("cannot issue document without items")) {
              const retryInvoices: Array<{ label: string; invoice: Record<string, unknown> }> = [
                {
                  label: "productCodeOnly-itemsArray",
                  invoice:
                    buildSalesInvoiceParameterProductCodeOnly("itemsArray") ||
                    buildSalesInvoiceParameterMinimal("itemsArray"),
                },
                {
                  label: "productCodeOnly-itemObject",
                  invoice:
                    buildSalesInvoiceParameterProductCodeOnly("itemObject") ||
                    buildSalesInvoiceParameterMinimal("itemObject"),
                },
                {
                  label: "minimal-itemsArray",
                  invoice: buildSalesInvoiceParameterMinimal("itemsArray"),
                },
                {
                  label: "minimal-itemObject",
                  invoice: buildSalesInvoiceParameterMinimal("itemObject"),
                },
                { label: "rich-alias", invoice: buildSalesInvoiceParameter() },
              ];
              for (const retryCase of retryInvoices) {
                const finalizedRetry = finalizeSalesInvoice(retryCase.invoice);
                const retryRes = await fetch(endpoint, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    username,
                    secretkey: secretKey,
                    secretKey,
                    token,
                    method,
                    parameters: {
                      SalesInvoice: finalizedRetry,
                      Salesinvoice: finalizedRetry,
                      salesInvoice: finalizedRetry,
                      customerEmail: params.userEmail,
                      deviceIdentifier: params.deviceIdentifier,
                      itemName,
                      note,
                      amountHuf: normalizedAmountHuf,
                      quantity: 1,
                      sendIssuedInvoiceByEmail: true,
                      generatePublicURL: true,
                    },
                  }),
                });
                const retryRaw = await retryRes.text();
                if (!retryRes.ok) {
                  let retryReadable = compact(retryRaw);
                  try {
                    const retryParsedErr = JSON.parse(retryRaw);
                    retryReadable = responseIndicatesFailure(retryParsedErr) || retryReadable;
                  } catch {
                    // keep compact text
                  }
                  attemptErrors.push(`${retryCase.label}: HTTP ${retryRes.status}: ${retryReadable}`);
                  continue;
                }
                try {
                  const retryParsed = JSON.parse(retryRaw);
                  const retryFailed = responseIndicatesFailure(retryParsed);
                  if (!retryFailed) {
                    const publicUrl = findFirstUrlByHint(retryParsed, [
                      "publicurl",
                      "public_url",
                      "documenturl",
                    ]);
                    const pdfUrl = findFirstUrlByHint(retryParsed, ["pdf", "pdfurl", "pdf_url"]);
                    return { ok: true, invoicePublicUrl: publicUrl, invoicePdfUrl: pdfUrl };
                  }
                  attemptErrors.push(`${retryCase.label}: ${retryFailed}`);
                } catch {
                  return { ok: true };
                }
              }
            }
            // If e-racuni already indicates invalid username/password, stop fallback noise.
            if (hasInvalidAuthMessage(parsedErr)) {
              return {
                ok: false,
                error: `[${endpoint}] Hitelesítési hiba: érvénytelen e-racuni felhasználónév vagy API jelszó. (username=${username ?? "n/a"}, mode=${useLiveCredentials ? "live" : "test"})`,
              };
            }
          } catch {
            // non-JSON HTTP error, continue collecting endpoint diagnostics
          }
          if ((readable || "").toLowerCase().includes("buyer data")) {
            const buyerRetryInvoice = finalizeSalesInvoice(buildSalesInvoiceParameter());
            const br = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username,
                secretkey: secretKey,
                secretKey,
                token,
                method,
                parameters: {
                  SalesInvoice: buyerRetryInvoice,
                  Salesinvoice: buyerRetryInvoice,
                  customerEmail: params.userEmail,
                  deviceIdentifier: params.deviceIdentifier,
                  itemName,
                  note,
                  amountHuf: normalizedAmountHuf,
                  quantity: 1,
                  sendIssuedInvoiceByEmail: true,
                  generatePublicURL: true,
                },
              }),
            });
            const brRaw = await br.text();
            if (br.ok) {
              try {
                const brParsed = JSON.parse(brRaw);
                const brFailed = responseIndicatesFailure(brParsed);
                if (!brFailed) {
                  const publicUrl = findFirstUrlByHint(brParsed, [
                    "publicurl",
                    "public_url",
                    "documenturl",
                  ]);
                  const pdfUrl = findFirstUrlByHint(brParsed, ["pdf", "pdfurl", "pdf_url"]);
                  return { ok: true, invoicePublicUrl: publicUrl, invoicePdfUrl: pdfUrl };
                }
              } catch {
                return { ok: true };
              }
            }
          }
          endpointErrors.push(
            `[${endpoint}] HTTP ${res.status}: ${readable ?? compact(raw)}${
              attemptErrors.length > 0 ? ` | retries: ${attemptErrors.join(" || ")}` : ""
            }`,
          );
          continue;
        }
        try {
          const parsed = JSON.parse(raw);
          const failed = responseIndicatesFailure(parsed);
          if (failed) {
            if (hasInvalidAuthMessage(parsed)) {
              return {
                ok: false,
                error: `[${endpoint}] Hitelesítési hiba: érvénytelen e-racuni felhasználónév vagy API jelszó. (username=${username ?? "n/a"}, mode=${useLiveCredentials ? "live" : "test"})`,
              };
            }
            if (failed.toLowerCase().includes("buyer data")) {
              const buyerRetryInvoice = finalizeSalesInvoice(buildSalesInvoiceParameter());
              const br = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  username,
                  secretkey: secretKey,
                  secretKey,
                  token,
                  method,
                  parameters: {
                    SalesInvoice: buyerRetryInvoice,
                    Salesinvoice: buyerRetryInvoice,
                    customerEmail: params.userEmail,
                    deviceIdentifier: params.deviceIdentifier,
                    itemName,
                    note,
                    amountHuf: normalizedAmountHuf,
                    quantity: 1,
                    sendIssuedInvoiceByEmail: true,
                    generatePublicURL: true,
                  },
                }),
              });
              const brRaw = await br.text();
              if (br.ok) {
                try {
                  const brParsed = JSON.parse(brRaw);
                  const brFailed = responseIndicatesFailure(brParsed);
                  if (!brFailed) {
                    const publicUrl = findFirstUrlByHint(brParsed, [
                      "publicurl",
                      "public_url",
                      "documenturl",
                    ]);
                    const pdfUrl = findFirstUrlByHint(brParsed, ["pdf", "pdfurl", "pdf_url"]);
                    return { ok: true, invoicePublicUrl: publicUrl, invoicePdfUrl: pdfUrl };
                  }
                } catch {
                  return { ok: true };
                }
              }
            }
            return { ok: false, error: failed };
          }
          const publicUrl = findFirstUrlByHint(parsed, ["publicurl", "public_url", "documenturl"]);
          const pdfUrl = findFirstUrlByHint(parsed, ["pdf", "pdfurl", "pdf_url"]);
          return { ok: true, invoicePublicUrl: publicUrl, invoicePdfUrl: pdfUrl };
        } catch {
          // Some e-racuni methods may return non-JSON/plain text on success.
          return { ok: true };
        }
      }
      return {
        ok: false,
        error:
          endpointErrors.length > 0
            ? endpointErrors.join(" | ")
            : "e-racuni endpoint hiba",
      };
    }

    // Legacy bearer mode
    const testKey =
      process.env.E_RACUNI_TEST_API_KEY?.trim() ||
      process.env.E_RACUNI_TEST_API_TOKEN?.trim();
    const liveKey =
      process.env.E_RACUNI_API_KEY?.trim() ||
      process.env.E_RACUNI_API_TOKEN?.trim();
    const key = useLiveCredentials ? liveKey : testKey || liveKey;
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
