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
    throw new Error(data.error ?? `Failed to load summary (${res.status})`);
  }
  return data;
}

