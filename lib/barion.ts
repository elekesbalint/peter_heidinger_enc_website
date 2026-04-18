/**
 * Barion Payment API integráció.
 *
 * Környezetek (POSKey és API host **párosan** kell hogy stimmeljen):
 *   Sandbox:  BARION_API_URL=https://api.test.barion.com  + sandbox bolt POSKey
 *   Éles:     BARION_API_URL=https://api.barion.com       + éles bolt POSKey
 *
 * Alapértelmezés BARION_API_URL nélkül:
 *   Vercel production → https://api.barion.com
 *   egyéb (local, preview) → https://api.test.barion.com
 *
 * Szükséges env változók:
 *   BARION_POSKEY   — Shop titkos kulcsa (Barion admin → Shop részletek)
 *   BARION_PAYEE    — Elfogadó Barion e-mail (a bolt Barion wallet címe)
 *   BARION_API_URL  — (opcionális) felülírja a fenti alapértelmezést
 */

/** Vercel / .env gyakori hiba: érték idézőjelekkel vagy BOM-mal — levágjuk. */
function normalizeMaybeQuotedEnv(value: string | undefined): string {
  if (!value) return "";
  let s = value.trim().replace(/^\uFEFF/, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("{") && s.endsWith("}")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function isLikelyBarionPosKeyGuid(key: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    key.trim(),
  );
}

export type BarionItem = {
  Name: string;
  Description: string;
  Quantity: number;
  Unit: string;
  UnitPrice: number;
  ItemTotal: number;
  SKU: string;
};

export type BarionTransaction = {
  POSTransactionId: string;
  Payee: string;
  Total: number;
  Items: BarionItem[];
};

export type BarionStartPaymentRequest = {
  PaymentType: "Immediate";
  GuestCheckOut: boolean;
  FundingSources: string[];
  PaymentRequestId: string;
  Locale: string;
  Currency: string;
  RedirectUrl: string;
  CallbackUrl: string;
  Transactions: BarionTransaction[];
  OrderNumber?: string;
  PayerHint?: string;
};

export type BarionApiError = {
  Title: string;
  Description: string;
  ErrorCode: string;
  HappenedAt: string;
  AuthCode?: string | null;
};

export type BarionStartPaymentResponse = {
  PaymentId?: string;
  PaymentRequestId?: string;
  Status?: string;
  GatewayUrl?: string;
  Errors?: BarionApiError[];
};

export type BarionPaymentStatus =
  | "Prepared"
  | "Started"
  | "InProgress"
  | "Waiting"
  | "Reserved"
  | "Authorized"
  | "Canceled"
  | "Succeeded"
  | "Failed"
  | "PartiallySucceeded"
  | "Expired";

export type BarionPaymentStateResponse = {
  PaymentId?: string;
  PaymentRequestId?: string;
  POSId?: string;
  Status?: BarionPaymentStatus;
  Currency?: string;
  Total?: number;
  Transactions?: Array<{
    POSTransactionId?: string;
    Status?: string;
    Total?: number;
    Currency?: string;
    Items?: BarionItem[];
  }>;
  PayerInfo?: {
    UserName?: string;
    Email?: string;
    Name?: string;
    Phone?: string;
  };
  BillingAddress?: {
    Country?: string;
    Region?: string;
    City?: string;
    Zip?: string;
    Street?: string;
    Street2?: string;
    FullName?: string;
    Phone?: string;
  };
  Errors?: BarionApiError[];
};

export function getBarionApiUrl(): string {
  const explicit = normalizeMaybeQuotedEnv(process.env.BARION_API_URL);
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  // Éles domain + éles POSKey gyakori; preview/local marad sandbox API alapértelmezésben.
  if (process.env.VERCEL_ENV === "production") {
    return "https://api.barion.com";
  }
  return "https://api.test.barion.com";
}

export function getBarionPosKey(): string {
  const key = normalizeMaybeQuotedEnv(process.env.BARION_POSKEY);
  if (!key) throw new Error("Hiányzó BARION_POSKEY környezeti változó.");
  if (!isLikelyBarionPosKeyGuid(key)) {
    throw new Error(
      "A BARION_POSKEY formátuma nem tűnik Barion GUID-nak (8-4-4-4-12 hex). Gyakran a „Shop ID” / más mező kerül ide a Secret key helyett.",
    );
  }
  return key;
}

export function getBarionPayee(): string {
  const payee = normalizeMaybeQuotedEnv(process.env.BARION_PAYEE);
  if (!payee) throw new Error("Hiányzó BARION_PAYEE környezeti változó.");
  return payee;
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Barion Payment Start — fizetési munkamenet indítása.
 * Visszaadja a GatewayUrl-t, ahova a felhasználót át kell irányítani.
 */
export async function startBarionPayment(
  req: BarionStartPaymentRequest,
): Promise<BarionStartPaymentResponse> {
  const posKey = getBarionPosKey();
  const apiUrl = getBarionApiUrl();

  // Fontos: a Barion szerver útvonala case-sensitive — /v2/Payment/Start (nem .../payment/start).
  const res = await fetch(`${apiUrl}/v2/Payment/Start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, POSKey: posKey }),
  });

  const rawText = await res.text();
  let data: BarionStartPaymentResponse;
  try {
    data = JSON.parse(rawText) as BarionStartPaymentResponse;
  } catch {
    throw new Error(
      `Barion válasz nem értelmezhető (HTTP ${res.status}). Ellenőrizd a BARION_API_URL címet (host: ${new URL(apiUrl).host}).`,
    );
  }

  if (data.Errors?.length) {
    const msg = data.Errors.map((e) => `${e.Title}: ${e.Description}`).join("; ");
    const authFail = data.Errors.some((e) => e.ErrorCode === "AuthenticationFailed");
    const host = new URL(apiUrl).host;
    const hint = authFail
      ? ` (Barion API: ${host}). Ez általában nem az URL hibája, ha már ${host} van beállítva: a BARION_POSKEY-nek ugyanahhoz a Barion környezethez kell tartoznia (sandbox bolt „Secret key” / POSKey a test felületen, ne éles bolt kulcsa). Vercelen ellenőrizd: a változó a megfelelő környezethez van-e kötve (Production / Preview), és env módosítás után legyen új deployment.`
      : "";
    throw new Error(`Barion hiba: ${msg}${hint}`);
  }

  if (!data.GatewayUrl) {
    throw new Error("Barion nem adott vissza GatewayUrl-t. Ellenőrizd a BARION_POSKEY és BARION_PAYEE értékeket.");
  }

  return data;
}

/**
 * Barion Payment State — fizetési állapot lekérése.
 * IPN callback feldolgozásánál kell a PaymentId-vel.
 */
export async function getBarionPaymentState(
  paymentId: string,
): Promise<BarionPaymentStateResponse> {
  const posKey = getBarionPosKey();
  const apiUrl = getBarionApiUrl();

  const url = new URL(`${apiUrl}/v2/Payment/GetPaymentState`);
  url.searchParams.set("POSKey", posKey);
  url.searchParams.set("PaymentId", paymentId);

  const res = await fetch(url.toString());
  const data = (await res.json()) as BarionPaymentStateResponse;
  return data;
}

/** Egyedi PaymentRequestId generálása — időbélyeg + véletlen szám alapján. */
export function generatePaymentRequestId(prefix = "enc"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}
