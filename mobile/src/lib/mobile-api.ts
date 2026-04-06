import type { Session } from "@supabase/supabase-js";
import { env } from "./env";

type MobileDevice = {
  identifier: string;
  category: string;
  status: string;
  licensePlate: string | null;
  balanceHuf: number;
};

type MobileTopup = {
  id: string;
  amountHuf: number;
  currency: string;
  status: string;
  paidAt: string | null;
  deviceIdentifier: string | null;
  travelDestination: string | null;
};

type MobileInvite = {
  id: string;
  invited_email: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  discount_used_at: string | null;
};

export type MobileSummary = {
  ok: true;
  fxEurToHuf: number;
  referralWalletBonusCapHuf: number;
  devices: MobileDevice[];
  topups: MobileTopup[];
  invites: MobileInvite[];
};

type CheckoutDevicePayload = {
  category: "ia" | "i" | "ii" | "iii" | "iv";
  licensePlate: string;
  contractAccepted: boolean;
};

type CheckoutTopupPayload = {
  topupAmountEur: number;
  selectedPackageEur?: number | null;
  deviceIdentifier: string;
  travelDestination: string;
};

export async function getMobileSummary(session: Session): Promise<MobileSummary> {
  const token = session.access_token;
  const url = `${env.webBaseUrl.replace(/\/$/, "")}/api/mobile/summary`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const data = (await res.json().catch(() => ({}))) as MobileSummary & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Nem sikerült betölteni az összegzést (${res.status})`);
  }
  return data;
}

export async function sendMobileReferralInvite(session: Session, email: string): Promise<void> {
  const url = `${env.webBaseUrl.replace(/\/$/, "")}/api/mobile/referrals/invite`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `A meghívó küldése sikertelen (${res.status})`);
  }
}

export async function createMobileDeviceCheckout(
  session: Session,
  payload: CheckoutDevicePayload,
): Promise<{ url?: string | null; waitlist?: boolean; message?: string }> {
  const url = `${env.webBaseUrl.replace(/\/$/, "")}/api/mobile/stripe/checkout-device`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    url?: string | null;
    waitlist?: boolean;
    message?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `A rendelési checkout indítása sikertelen (${res.status})`);
  }
  return { url: data.url, waitlist: data.waitlist, message: data.message };
}

export async function createMobileTopupCheckout(
  session: Session,
  payload: CheckoutTopupPayload,
): Promise<{ url: string }> {
  const url = `${env.webBaseUrl.replace(/\/$/, "")}/api/mobile/stripe/checkout`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; url?: string };
  if (!res.ok || !data.ok || !data.url) {
    throw new Error(data.error ?? `A feltöltési checkout indítása sikertelen (${res.status})`);
  }
  return { url: data.url };
}

export async function sendMobileContactMessage(payload: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const url = `${env.webBaseUrl.replace(/\/$/, "")}/api/contact`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Az üzenetküldés sikertelen (${res.status})`);
  }
}

