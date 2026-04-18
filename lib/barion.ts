/**
 * Barion Payment API integráció.
 *
 * Környezetek:
 *   Sandbox:  BARION_API_URL=https://api.test.barion.com  (alapértelmezett)
 *   Éles:     BARION_API_URL=https://api.barion.com
 *
 * Szükséges env változók:
 *   BARION_POSKEY   — Shop titkos kulcsa (Barion admin → Shop részletek)
 *   BARION_PAYEE    — Elfogadó Barion e-mail cím (pl. dpccroatia@gmail.com)
 *   BARION_API_URL  — (opcionális) API alap URL, alapértelmezett: sandbox
 */

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
  return (process.env.BARION_API_URL ?? "https://api.test.barion.com").replace(/\/$/, "");
}

export function getBarionPosKey(): string {
  const key = process.env.BARION_POSKEY?.trim();
  if (!key) throw new Error("Hiányzó BARION_POSKEY környezeti változó.");
  return key;
}

export function getBarionPayee(): string {
  const payee = process.env.BARION_PAYEE?.trim();
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
    headers: {
      "Content-Type": "application/json",
      // Shop auth: a dokumentáció szerint headerben is elfogadott.
      "x-pos-key": posKey,
    },
    body: JSON.stringify({ ...req, POSKey: posKey }),
  });

  const data = (await res.json()) as BarionStartPaymentResponse;

  if (data.Errors?.length) {
    const msg = data.Errors.map((e) => `${e.Title}: ${e.Description}`).join("; ");
    throw new Error(`Barion hiba: ${msg}`);
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

  const res = await fetch(url.toString(), { headers: { "x-pos-key": posKey } });
  const data = (await res.json()) as BarionPaymentStateResponse;
  return data;
}

/** Egyedi PaymentRequestId generálása — időbélyeg + véletlen szám alapján. */
export function generatePaymentRequestId(prefix = "enc"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}
