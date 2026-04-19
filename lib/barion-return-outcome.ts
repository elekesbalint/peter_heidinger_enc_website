import "server-only";

import { getBarionPaymentState, type BarionPaymentStatus } from "@/lib/barion";

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() ? s.trim() : undefined;
}

/** Barion a visszatéréskor a query stringbe illeszti a `paymentId` (kisbetű is lehet). */
export function pickBarionPaymentIdFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): string | undefined {
  for (const key of ["paymentId", "PaymentId"] as const) {
    const id = firstString(sp[key]);
    if (id) return id;
  }
  return undefined;
}

export function isBarionReturnQuery(
  sp: Record<string, string | string[] | undefined>,
): boolean {
  const b = firstString(sp.barion);
  return b === "1" || b === "true" || b === "yes";
}

export function firstSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  return firstString(sp[key]);
}

export type BarionReturnOutcome =
  | { kind: "success"; status: BarionPaymentStatus }
  | { kind: "not_completed"; status?: BarionPaymentStatus }
  | { kind: "verify_error"; message: string };

/**
 * Barion a RedirectUrl-re minden visszatéréskor (siker, vissza, megszakítás) rátold a
 * paymentId-t; a tényleges kimenetet a GetPaymentState alapján kell eldönteni.
 */
export async function evaluateBarionReturn(paymentId: string): Promise<BarionReturnOutcome> {
  try {
    const state = await getBarionPaymentState(paymentId);
    if (state.Errors?.length) {
      const msg = state.Errors.map((e) => `${e.Title ?? "Hiba"}: ${e.Description ?? ""}`).join(
        "; ",
      );
      return { kind: "verify_error", message: msg || "A Barion állapotlekérése sikertelen." };
    }

    const status = state.Status;
    if (!status) {
      return { kind: "verify_error", message: "Hiányzó fizetési állapot (Barion válasz)." };
    }

    if (status === "Succeeded" || status === "PartiallySucceeded") {
      return { kind: "success", status };
    }

    return { kind: "not_completed", status };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Ismeretlen hiba történt az állapot ellenőrzésekor.";
    return { kind: "verify_error", message };
  }
}
